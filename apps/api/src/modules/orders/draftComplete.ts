import { type Db, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { isProductPublished, lockVariantsForKeyShare } from "../catalog/index.ts";
import { getActiveUserIdByEmail } from "../identity/index.ts";
import {
  allocateStocks,
  findInsufficientStock,
  lockStocksForVariants,
} from "../inventory/index.ts";
import { refreshDraftLines } from "./draftLines.ts";
import { type DraftShippingMethod, lockDraftOrder, saveDraftTotals } from "./drafts.ts";
import type { OrderError } from "./lifecycle.ts";
import type { OrderRow } from "./orders.ts";

// Saleor's draftOrderComplete (saleor/graphql/order/mutations/draft_order_complete.py,
// validate_draft_order in saleor/graphql/order/utils.py) for PLAN M13.4. In one transaction, with
// checkout completion's lock order (order → variants FOR KEY SHARE → stock rows by id): the draft's
// prices are re-read one last time (decision 2), Saleor's checks run (minus shipping: the shop
// doesn't ship yet, owner 2026-11-14, so a draft needs no shipping address or method; one that
// has a method gets its current price), stock is reserved for tracked lines (or the draft stays a draft with
// INSUFFICIENT_STOCK), the customer is linked by email, and the order becomes UNFULFILLED with a
// PLACED_FROM_DRAFT event. No confirmation email (decision 3); the order starts unpaid.

export type CompleteDraftResult =
  | { ok: true; order: OrderRow }
  | { ok: false; errors: OrderError[] };

/** The draft's shipping method as it is now; null when it was deleted or never set. */
export type CurrentShippingMethod = DraftShippingMethod & { isActive: boolean };

const MESSAGES = {
  notDraft: "The order is not draft.",
  noLines: "Could not create order without any products.",
  noEmail: "Can't finalize draft with no customer email.",
  noBillingAddress: "Can't finalize draft with no billing address.",
  shippingNotApplicable: "Shipping method is not applicable.",
  deletedVariant: "Could not create orders with non-existing products.",
  notPublished: "Can't finalize draft with unpublished product.",
  insufficientStock: "Insufficient product stock.",
} as const;

export async function completeDraftOrder(
  db: Db,
  input: {
    orderId: string;
    userId: string | null;
    /** Read by the GraphQL layer from the checkout module, which owns shipping methods. */
    shippingMethod: CurrentShippingMethod | null;
  },
): Promise<CompleteDraftResult> {
  return db.transaction(async (tx) => {
    const locked = await lockDraftOrder(tx, input.orderId, {
      code: "INVALID",
      message: MESSAGES.notDraft,
    });
    if (!locked.ok) return locked;
    const draft = await refreshDraftLines(tx, locked.order);
    const lines = await tx
      .select()
      .from(schema.orderLine)
      .where(eq(schema.orderLine.orderId, draft.id));

    // Saleor's validate_draft_order, in its order, plus the email our orders require.
    const errors: OrderError[] = [];
    if (draft.billingAddress === null) {
      errors.push({
        field: "billingAddress",
        code: "BILLING_ADDRESS_NOT_SET",
        message: MESSAGES.noBillingAddress,
      });
    }
    const method = draft.shippingMethodId === null ? null : input.shippingMethod;
    if (draft.shippingMethodId !== null && (method === null || !method.isActive)) {
      errors.push({
        field: "shippingMethod",
        code: "SHIPPING_METHOD_NOT_APPLICABLE",
        message: MESSAGES.shippingNotApplicable,
      });
    }
    if (lines.reduce((sum, line) => sum + line.quantity, 0) === 0) {
      errors.push({ field: "lines", code: "REQUIRED", message: MESSAGES.noLines });
    }
    if (lines.some((line) => line.variantId === null)) {
      errors.push({ field: "lines", code: "NOT_FOUND", message: MESSAGES.deletedVariant });
    }
    const variantIds = lines.flatMap((line) => (line.variantId ? [line.variantId] : []));
    // Already locked FOR KEY SHARE by refreshDraftLines; read again for the products.
    const variants = new Map(
      (await lockVariantsForKeyShare(tx, variantIds)).map((row) => [row.variant.id, row]),
    );
    if ([...variants.values()].some((row) => !isProductPublished(row.product))) {
      errors.push({
        field: "lines",
        code: "PRODUCT_NOT_PUBLISHED",
        message: MESSAGES.notPublished,
      });
    }
    if (draft.userEmail === null) {
      errors.push({ field: "userEmail", code: "REQUIRED", message: MESSAGES.noEmail });
    }
    if (errors.length > 0) return { ok: false, errors };

    // The shipping price is the method's current one (it may have changed since it was chosen);
    // without a method there is no shipping.
    await tx
      .update(schema.order)
      .set({
        shippingMethodName: method?.name ?? null,
        shippingPriceAmount: method?.priceAmount ?? 0,
        totalAmount: sql`${schema.order.subtotalAmount} + ${method?.priceAmount ?? 0}`,
      })
      .where(eq(schema.order.id, draft.id));

    // Stock for tracked lines, summed per variant (one variant may be on several lines).
    const tracked = lines.filter(
      (line) => line.variantId !== null && variants.get(line.variantId)?.variant.trackInventory,
    );
    const stocks = await lockStocksForVariants(
      tx,
      tracked.map((line) => line.variantId ?? ""),
    );
    const requested = new Map<string, number>();
    for (const line of tracked) {
      const variantId = line.variantId ?? "";
      requested.set(variantId, (requested.get(variantId) ?? 0) + line.quantity);
    }
    const insufficient = findInsufficientStock(
      stocks,
      [...requested].map(([variantId, quantity]) => ({ variantId, quantity })),
    );
    if (insufficient.length > 0) {
      return {
        ok: false,
        errors: insufficient.map((item) => ({
          field: "lines",
          code: "INSUFFICIENT_STOCK" as const,
          message: MESSAGES.insufficientStock,
          orderLines: tracked
            .filter((line) => line.variantId === item.variantId)
            .map((line) => line.id),
          variants: [item.variantId],
        })),
      };
    }
    await allocateStocks(
      tx,
      stocks,
      tracked.map((line) => ({
        orderLineId: line.id,
        variantId: line.variantId ?? "",
        quantity: line.quantity,
      })),
    );

    // Saleor: an email without an account goes to the active account that has it.
    const userId =
      draft.userId ??
      (draft.userEmail === null ? null : await getActiveUserIdByEmail(tx, draft.userEmail));
    await tx
      .update(schema.order)
      .set({ status: "UNFULFILLED", userId, updatedAt: sql`now()` })
      .where(eq(schema.order.id, draft.id));
    await tx
      .insert(schema.orderEvent)
      .values({ orderId: draft.id, type: "PLACED_FROM_DRAFT", userId: input.userId });
    return { ok: true, order: await saveDraftTotals(tx, draft.id) };
  });
}
