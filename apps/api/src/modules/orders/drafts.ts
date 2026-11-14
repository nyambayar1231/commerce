import { addMoney, type CurrencyCode } from "@commerce/contracts";
import { type Db, type Executor, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { lockOrderTransactions } from "../payments/index.ts";
import { getShop } from "../shop/index.ts";
import { lockOrder, type OrderError } from "./lifecycle.ts";
import type { OrderRow } from "./orders.ts";

// Draft orders (PLAN M13 decisions 1-3): Saleor's draftOrderCreate, draftOrderUpdate and
// draftOrderDelete (saleor/graphql/order/mutations/draft_order_*.py). A draft is an `order` row
// with status DRAFT whose customer, addresses and shipping may still be missing. The checkout
// module owns addresses and shipping methods, so the GraphQL layer validates those and hands them
// over cleaned (ARCHITECTURE §2 rule 2); this module only stores them. Every write locks the order
// first, like the lifecycle actions, and recalculates the stored totals.

/** A shipping method as the draft remembers it: the id to re-read at completion, a snapshot. */
export type DraftShippingMethod = { id: string; name: string; priceAmount: number };

/** The draft's customer: an account (with its email) or only an email. */
export type DraftCustomer = { userId: string | null; email: string };

/**
 * The fields draftOrderCreate/draftOrderUpdate set. `undefined` keeps the current value, `null`
 * clears it (Saleor's input semantics).
 */
export type DraftOrderInput = {
  customer?: DraftCustomer | null;
  /** A cleaned address (checkout's cleanAddress) as stored JSON. */
  billingAddress?: unknown;
  shippingAddress?: unknown;
  shippingMethod?: DraftShippingMethod | null;
};

export type DraftOrderResult = { ok: true; order: OrderRow } | { ok: false; errors: OrderError[] };

export const DRAFT_MESSAGES = {
  notFound: "Order does not exist.",
  notDraft: "Provided order id belongs to non-draft order. Use `orderUpdate` mutation instead.",
  notDraftDelete: "Provided order id belongs to non-draft order.",
  hasTransactions: "Cannot delete order with payments or transactions attached to it.",
} as const;

const notFound = (): DraftOrderResult => ({
  ok: false,
  errors: [{ field: "id", code: "NOT_FOUND", message: DRAFT_MESSAGES.notFound }],
});

/** The column values an input sets; fields left `undefined` are absent. */
function inputColumns(input: DraftOrderInput) {
  const columns: Partial<typeof schema.order.$inferInsert> = {};
  if (input.customer !== undefined) {
    columns.userId = input.customer?.userId ?? null;
    columns.userEmail = input.customer?.email ?? null;
  }
  if (input.billingAddress !== undefined) columns.billingAddress = input.billingAddress;
  if (input.shippingAddress !== undefined) columns.shippingAddress = input.shippingAddress;
  if (input.shippingMethod !== undefined) {
    columns.shippingMethodId = input.shippingMethod?.id ?? null;
    columns.shippingMethodName = input.shippingMethod?.name ?? null;
    columns.shippingPriceAmount = input.shippingMethod?.priceAmount ?? 0;
  }
  return columns;
}

/**
 * Stores the draft's subtotal (its lines' totals) and total (+ shipping), as the database's
 * `order_total_is_subtotal_plus_shipping` check expects. Must run in the caller's transaction,
 * with the order locked.
 */
export async function saveDraftTotals(tx: Executor, orderId: string): Promise<OrderRow> {
  const [order] = await tx.select().from(schema.order).where(eq(schema.order.id, orderId));
  if (!order) throw new Error(`order ${orderId} disappeared`);
  const currency = order.currency as CurrencyCode;
  const lines = await tx
    .select({ total: schema.orderLine.totalPriceAmount })
    .from(schema.orderLine)
    .where(eq(schema.orderLine.orderId, orderId));
  const subtotal = lines.reduce(
    (sum, line) => addMoney(sum, { amountMinor: line.total, currency }),
    {
      amountMinor: 0,
      currency,
    },
  );
  const total = addMoney(subtotal, { amountMinor: order.shippingPriceAmount, currency });
  const [updated] = await tx
    .update(schema.order)
    .set({
      subtotalAmount: subtotal.amountMinor,
      totalAmount: total.amountMinor,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.order.id, orderId))
    .returning();
  if (!updated) throw new Error(`order ${orderId} disappeared`);
  return updated;
}

/** The order locked for a draft-only write, or the error Saleor returns for it. */
export async function lockDraftOrder(
  tx: Executor,
  orderId: string,
  notDraft: Pick<OrderError, "code" | "message"> = {
    code: "INVALID",
    message: DRAFT_MESSAGES.notDraft,
  },
): Promise<DraftOrderResult> {
  const order = await lockOrder(tx, orderId);
  if (!order) return notFound();
  if (order.status !== "DRAFT") return { ok: false, errors: [{ field: "id", ...notDraft }] };
  return { ok: true, order };
}

/** Saleor's draftOrderCreate (lines are added with orderLinesCreate, M13.3). */
export async function createDraftOrder(
  db: Db,
  input: { staffUserId: string | null; draft: DraftOrderInput },
): Promise<OrderRow> {
  return db.transaction(async (tx) => {
    const shop = await getShop(tx);
    const columns = inputColumns(input.draft);
    const [order] = await tx
      .insert(schema.order)
      .values({
        status: "DRAFT",
        shippingPriceAmount: 0,
        currency: shop.currency,
        ...columns,
        // No lines yet: the total is the shipping price (saveDraftTotals keeps it so).
        subtotalAmount: 0,
        totalAmount: columns.shippingPriceAmount ?? 0,
      })
      .returning();
    if (!order) throw new Error("order insert returned no row");
    await tx
      .insert(schema.orderEvent)
      .values({ orderId: order.id, type: "DRAFT_CREATED", userId: input.staffUserId });
    return saveDraftTotals(tx, order.id);
  });
}

/** Saleor's draftOrderUpdate: only a draft can be updated this way. */
export async function updateDraftOrder(
  db: Db,
  input: { orderId: string; draft: DraftOrderInput },
): Promise<DraftOrderResult> {
  return db.transaction(async (tx) => {
    const locked = await lockDraftOrder(tx, input.orderId);
    if (!locked.ok) return locked;
    const columns = inputColumns(input.draft);
    if (Object.keys(columns).length > 0) {
      const shipping = columns.shippingPriceAmount;
      await tx
        .update(schema.order)
        .set({
          ...columns,
          // The total follows a new shipping price in the same statement (the database checks it).
          ...(shipping === undefined
            ? {}
            : { totalAmount: sql`${schema.order.subtotalAmount} + ${shipping}` }),
        })
        .where(eq(schema.order.id, input.orderId));
    }
    return { ok: true, order: await saveDraftTotals(tx, input.orderId) };
  });
}

/**
 * Saleor's draftOrderDelete: only a draft without payment transactions. Its lines and events go
 * with it. Returns the deleted row (Saleor's payload keeps the order, with its id).
 */
export async function deleteDraftOrder(
  db: Db,
  input: { orderId: string },
): Promise<DraftOrderResult> {
  return db.transaction(async (tx) => {
    const locked = await lockDraftOrder(tx, input.orderId, {
      code: "INVALID",
      message: DRAFT_MESSAGES.notDraftDelete,
    });
    if (!locked.ok) return locked;
    const transactions = await lockOrderTransactions(tx, input.orderId);
    if (transactions.length > 0) {
      return {
        ok: false,
        errors: [{ field: "id", code: "INVALID", message: DRAFT_MESSAGES.hasTransactions }],
      };
    }
    await tx.delete(schema.orderEvent).where(eq(schema.orderEvent.orderId, input.orderId));
    await tx.delete(schema.orderLine).where(eq(schema.orderLine.orderId, input.orderId));
    await tx.delete(schema.order).where(eq(schema.order.id, input.orderId));
    return { ok: true, order: locked.order };
  });
}
