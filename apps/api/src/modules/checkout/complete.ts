import type { CurrencyCode } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { lockVariantsForKeyShare } from "../catalog/index.ts";
import { getActiveUserIdByEmail } from "../identity/index.ts";
import {
  allocateStocks,
  findInsufficientStock,
  lockStocksForVariants,
} from "../inventory/index.ts";
import {
  createOrderFromCheckout,
  enqueueOrderConfirmation,
  getOrder,
  type OrderRow,
} from "../orders/index.ts";
import {
  getTransactionsByCheckoutIds,
  moveCheckoutTransactionsToOrder,
} from "../payments/index.ts";
import {
  type CheckoutError,
  getCheckoutLines,
  getCheckoutShippingMethod,
  isPublished,
  lockCheckout,
} from "./checkouts.ts";
import { checkoutPaymentStatuses } from "./payments.ts";
import { calculateCheckoutTotals } from "./totals.ts";

// checkoutComplete — the consistency-critical flow (ARCHITECTURE.md §5.4; Saleor's
// saleor/checkout/complete_checkout.py). One READ COMMITTED transaction across checkout, catalog,
// inventory, orders and payments, with explicit locks in one order:
//   checkout (FOR UPDATE) → variants (FOR KEY SHARE, by id) → stock rows (FOR UPDATE, by id)
// The checkout lock serializes a double submit; the stock locks make the availability check
// authoritative; `completed_order_id` and the unique `order.checkout_token` make it idempotent.

export type CheckoutCompleteResult =
  | { ok: true; order: OrderRow; created: boolean }
  | { ok: false; errors: CheckoutError[] };

const MESSAGES = {
  noLines: "Cannot complete checkout without lines.",
  emailNotSet: "Checkout email must be set.",
  shippingAddressNotSet: "Shipping address is not set.",
  billingAddressNotSet: "Billing address is not set.",
  shippingMethodNotSet: "Shipping method is not set.",
  invalidShippingMethod: "Shipping method is not valid for your shipping address.",
  notPublished: "Can't complete the checkout with unpublished products.",
  notFullyPaid: "Provided payment methods can not cover the checkout's total amount.",
  insufficientStock: (label: string, available: number) =>
    `Insufficient stock for ${label}. Only ${available} remaining in stock.`,
};

const error = (
  field: string | null,
  code: CheckoutError["code"],
  message: string,
  variants: string[] | null = null,
): CheckoutError => ({ field, code, message, variants, lines: null });

/**
 * Completes a checkout into an order. A checkout that is already completed returns its order
 * (`created: false`). An unknown checkout throws CheckoutNotFoundError.
 */
export async function completeCheckout(
  db: Executor,
  checkoutId: string,
): Promise<CheckoutCompleteResult> {
  return db.transaction(async (tx) => {
    // 1. Serialize completes (and every other write) of this checkout.
    const checkout = await lockCheckout(tx, checkoutId);
    if (checkout.completedOrderId !== null) {
      const order = await getOrder(tx, checkout.completedOrderId);
      if (!order) throw new Error(`checkout ${checkoutId} points at a missing order`);
      return { ok: true, order, created: false };
    }

    // 2. Validate what the order needs (Saleor's clean_checkout_* checks).
    const errors: CheckoutError[] = [];
    const lines = await getCheckoutLines(tx, checkoutId);
    if (lines.length === 0) errors.push(error("lines", "NO_LINES", MESSAGES.noLines));
    if (!checkout.email) errors.push(error("email", "EMAIL_NOT_SET", MESSAGES.emailNotSet));
    if (checkout.shippingAddress === null) {
      errors.push(
        error("shippingAddress", "SHIPPING_ADDRESS_NOT_SET", MESSAGES.shippingAddressNotSet),
      );
    }
    const shippingMethod = await getCheckoutShippingMethod(tx, checkout);
    if (checkout.shippingMethodId === null) {
      errors.push(
        error("shippingMethod", "SHIPPING_METHOD_NOT_SET", MESSAGES.shippingMethodNotSet),
      );
    } else if (!shippingMethod) {
      errors.push(
        error("shippingMethod", "INVALID_SHIPPING_METHOD", MESSAGES.invalidShippingMethod),
      );
    }
    if (checkout.billingAddress === null) {
      errors.push(
        error("billingAddress", "BILLING_ADDRESS_NOT_SET", MESSAGES.billingAddressNotSet),
      );
    }

    // Variants before stocks (ARCHITECTURE §2 rule 6): they can't be deleted or locked for update
    // by a stock write until we commit, and their products' publication is read under the lock.
    const variants = new Map(
      (
        await lockVariantsForKeyShare(
          tx,
          lines.map((line) => line.variantId),
        )
      ).map((row) => [row.variant.id, row]),
    );
    const unpublished = lines
      .filter((line) => {
        const row = variants.get(line.variantId);
        return !row || !isPublished(row.product);
      })
      .map((line) => line.variantId);
    if (unpublished.length > 0) {
      errors.push(error("lines", "PRODUCT_NOT_PUBLISHED", MESSAGES.notPublished, unpublished));
    }
    if (errors.length > 0 || !shippingMethod || !checkout.email) return { ok: false, errors };

    // 3. Fresh totals at current prices (§5.2).
    const totals = await calculateCheckoutTotals(tx, checkoutId);

    // 4. The transactions must cover the total (Saleor: authorize status FULL).
    const transactions = await getTransactionsByCheckoutIds(tx, [checkoutId]);
    const { authorizeStatus } = checkoutPaymentStatuses(totals.total.gross, true, transactions);
    if (authorizeStatus !== "FULL") {
      return { ok: false, errors: [error(null, "CHECKOUT_NOT_FULLY_PAID", MESSAGES.notFullyPaid)] };
    }

    // 5. Authoritative stock check under the stock rows' locks (tracked variants only).
    const tracked = lines.filter((line) => variants.get(line.variantId)?.variant.trackInventory);
    const stocks = await lockStocksForVariants(
      tx,
      tracked.map((line) => line.variantId),
    );
    const insufficient = findInsufficientStock(stocks, tracked);
    if (insufficient.length > 0) {
      return {
        ok: false,
        errors: insufficient.map((item) => {
          const variant = variants.get(item.variantId)?.variant;
          const label = variant?.sku || variant?.name || item.variantId;
          return error(
            "quantity",
            "INSUFFICIENT_STOCK",
            MESSAGES.insufficientStock(label, item.available),
            [item.variantId],
          );
        }),
      };
    }

    // 6. The order: a snapshot of names, prices and addresses. It belongs to the checkout's owner;
    // a guest checkout goes to the active account with its email, if any (Saleor's
    // assign_checkout_user), so a registered customer finds it in their orders.
    const userId =
      checkout.userId ??
      (checkout.email === null ? null : await getActiveUserIdByEmail(tx, checkout.email));
    const priced = new Map(totals.lines.map((line) => [line.line.id, line]));
    const { order, lines: orderLines } = await createOrderFromCheckout(tx, {
      checkoutToken: checkout.id,
      userId,
      userEmail: checkout.email,
      billingAddress: checkout.billingAddress,
      shippingAddress: checkout.shippingAddress,
      shippingMethodName: shippingMethod.name,
      shippingPriceAmount: totals.shipping.gross.amountMinor,
      subtotalAmount: totals.subtotal.gross.amountMinor,
      totalAmount: totals.total.gross.amountMinor,
      currency: checkout.currency as CurrencyCode,
      lines: lines.map((line) => {
        const row = variants.get(line.variantId);
        const price = priced.get(line.id);
        if (!row || !price) throw new Error(`checkout line ${line.id} lost its variant`);
        return {
          variantId: row.variant.id,
          productName: row.product.name,
          variantName: row.variant.name,
          productSku: row.variant.sku,
          quantity: line.quantity,
          unitPriceAmount: price.unitPrice.amountMinor,
        };
      }),
    });

    // 7. Allocate the tracked lines from the stocks locked in step 5.
    const trackedVariants = new Set(tracked.map((line) => line.variantId));
    await allocateStocks(
      tx,
      stocks,
      orderLines
        .filter((line) => line.variantId !== null && trackedVariants.has(line.variantId))
        .map((line) => ({
          orderLineId: line.id,
          variantId: line.variantId ?? "",
          quantity: line.quantity,
        })),
    );

    // 8. The payments now belong to the order; 9. the checkout becomes read-only.
    await moveCheckoutTransactionsToOrder(tx, checkoutId, order.id);
    await tx
      .update(schema.checkout)
      .set({ completedOrderId: order.id, updatedAt: sql`now()` })
      .where(eq(schema.checkout.id, checkoutId));

    // 10. The confirmation email, as a job in this transaction (ARCHITECTURE.md §5.6): it exists
    // only if the order commits, and a retried completion (step 1) never adds a second one.
    await enqueueOrderConfirmation(tx, order.id);

    return { ok: true, order, created: true };
  });
}
