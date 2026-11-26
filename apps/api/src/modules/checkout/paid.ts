import { type Db, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { logger } from "../../logger.ts";
import { defineJobHandler } from "../jobs/index.ts";
import { refundOrderOverpayment } from "../orders/index.ts";
import {
  type GatewayRegistry,
  getTransactionsByCheckoutIds,
  lockCheckoutTransactions,
  paidCheckoutQueue,
  processRefundRequest,
  recordRefundRequest,
  refundableAmount,
} from "../payments/index.ts";
import { type CheckoutError, getCheckout, lockCheckout } from "./checkouts.ts";
import { completeCheckout } from "./complete.ts";
import { checkoutPaymentStatuses } from "./payments.ts";
import { calculateCheckoutTotals } from "./totals.ts";

// Orders are made by the server once a checkout is paid (ADR-0016 §5; Saleor's automatic
// completion of fully paid checkouts, saleor/checkout/tasks.py). The shopper's browser may never
// come back from the payment page; the order must exist anyway. Everything here is idempotent:
// the job may run several times for one payment (pg-boss retries, the reconciliation job).

export type PaidCheckoutResult =
  | { kind: "missing" }
  /** Not (or no longer) fully paid: nothing to do automatically (e.g. paid in parts). */
  | { kind: "not_paid" }
  | { kind: "completed"; orderId: string; overpaymentRefunded: number }
  /** Paid, but it can't become an order: every payment was refunded. */
  | { kind: "refunded"; amount: number; errors: CheckoutError[] };

const REFUND_REASON = "The order could not be created; the payment is returned.";

/**
 * Refunds everything a checkout that can't become an order holds. The refund requests are made
 * under the checkout's lock (a concurrent completion either finished first — then nothing is
 * refunded — or waits); the gateways are asked after it is released.
 */
async function refundCheckout(db: Db, gateways: GatewayRegistry, checkoutId: string) {
  const requests = await db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    if (checkout.completedOrderId !== null) return [];
    const made: { transactionId: string; requestId: string; amount: number }[] = [];
    for (const transaction of await lockCheckoutTransactions(tx, checkoutId)) {
      const amount = refundableAmount(transaction);
      if (amount <= 0) continue;
      const { request } = await recordRefundRequest(tx, transaction, amount, REFUND_REASON);
      made.push({ transactionId: transaction.id, requestId: request.id, amount });
    }
    return made;
  });
  for (const request of requests) {
    await processRefundRequest(
      db,
      gateways,
      request.transactionId,
      request.requestId,
      REFUND_REASON,
    );
  }
  return requests.reduce((sum, request) => sum + request.amount, 0);
}

/**
 * The job: completes a fully paid checkout into an order (refunding any overpayment), or refunds
 * a paid checkout that can't become one (stock sold meanwhile, product unpublished, …).
 */
export async function completePaidCheckout(
  db: Db,
  gateways: GatewayRegistry,
  checkoutId: string,
): Promise<PaidCheckoutResult> {
  const checkout = await getCheckout(db, checkoutId);
  if (!checkout) return { kind: "missing" };
  if (checkout.completedOrderId !== null) {
    const overpaymentRefunded = await refundOrderOverpayment(
      db,
      gateways,
      checkout.completedOrderId,
    );
    return { kind: "completed", orderId: checkout.completedOrderId, overpaymentRefunded };
  }

  const [totals, transactions] = await Promise.all([
    calculateCheckoutTotals(db, checkoutId),
    getTransactionsByCheckoutIds(db, [checkoutId]),
  ]);
  const { chargeStatus } = checkoutPaymentStatuses(totals.total.gross, true, transactions);
  if (chargeStatus !== "FULL" && chargeStatus !== "OVERCHARGED") {
    if (chargeStatus === "PARTIAL") {
      logger.warn({ checkoutId }, "A checkout is paid in part; no order is made automatically");
    }
    return { kind: "not_paid" };
  }

  const result = await completeCheckout(db, checkoutId);
  if (result.ok) {
    const overpaymentRefunded = await refundOrderOverpayment(db, gateways, result.order.id);
    return { kind: "completed", orderId: result.order.id, overpaymentRefunded };
  }
  const amount = await refundCheckout(db, gateways, checkoutId);
  if (amount === 0) {
    // Refunded by an earlier run (or completed meanwhile): nothing new to report.
    const after = await getCheckout(db, checkoutId);
    if (after?.completedOrderId) {
      return { kind: "completed", orderId: after.completedOrderId, overpaymentRefunded: 0 };
    }
    return { kind: "not_paid" };
  }
  logger.error({ checkoutId, amount, errors: result.errors }, "A paid checkout was refunded");
  return { kind: "refunded", amount, errors: result.errors };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The staff email for a refunded checkout. */
export function renderPaidCheckoutRefunded(
  checkoutId: string,
  email: string | null,
  amount: number,
  currency: string,
  errors: readonly CheckoutError[],
) {
  const reasons = errors.map((error) => `- ${error.message}`).join("\n");
  const text =
    `A customer paid ${amount} ${currency} but the order could not be created, so the payment ` +
    `is being refunded.\n\nCheckout: ${checkoutId}\nCustomer email: ${email ?? "(none)"}\n\n` +
    `Reasons:\n${reasons}\n\nPlease contact the customer. A refund shown as pending is ` +
    `completed by the payment provider.`;
  return {
    subject: `Payment refunded: an order could not be created (${amount} ${currency})`,
    text,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
  };
}

/** `STAFF_NOTIFICATION_EMAILS` (comma-separated): who hears about refunded paid checkouts. */
export function readStaffNotificationEmails(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const emails = (env.STAFF_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email !== "");
  const invalid = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid.length > 0) {
    throw new Error(`STAFF_NOTIFICATION_EMAILS: not an email address: ${invalid.join(", ")}`);
  }
  return emails;
}

/**
 * The worker's handler (src/worker.ts). `staffEmails` (STAFF_NOTIFICATION_EMAILS) get a message
 * when a paid checkout had to be refunded; with none, it is logged only.
 */
export const createPaidCheckoutHandler = (
  gateways: GatewayRegistry,
  staffEmails: readonly string[],
) =>
  defineJobHandler(paidCheckoutQueue, async (data, { db, mailer }) => {
    if ("orderId" in data) {
      await refundOrderOverpayment(db, gateways, data.orderId);
      return;
    }
    const result = await completePaidCheckout(db, gateways, data.checkoutId);
    if (result.kind !== "refunded" || staffEmails.length === 0) return;
    const [checkout] = await db
      .select({ email: schema.checkout.email, currency: schema.checkout.currency })
      .from(schema.checkout)
      .where(eq(schema.checkout.id, data.checkoutId));
    const message = renderPaidCheckoutRefunded(
      data.checkoutId,
      checkout?.email ?? null,
      result.amount,
      checkout?.currency ?? "MNT",
      result.errors,
    );
    for (const to of staffEmails) await mailer.send({ to, ...message });
  });
