import { defineQueue } from "../jobs/index.ts";

// The payments module's background work (ADR-0016 §5–6), run by the worker (src/worker.ts).

/**
 * A checkout received a successful payment: complete it into an order (or refund it when it
 * can't become one). Added in the same database transaction that records the payment, so it
 * exists exactly when the payment does. Defined here, handled by the checkout module (which may
 * depend on payments; payments must not depend on checkout).
 */
export const paidCheckoutQueue = defineQueue<
  /** A checkout's payment, or a late payment on a transaction that already moved to an order. */
  { checkoutId: string } | { orderId: string }
>("checkout-paid", {
  // Completion is idempotent; retries cover a database or gateway hiccup.
  retryLimit: 10,
});

/**
 * Every 2 minutes: payments and refunds still waiting on a gateway are read again, requests the
 * gateway never answered are closed, and paid checkouts without an order are completed. A run
 * that fails is simply superseded by the next one.
 */
export const reconcilePaymentsQueue = defineQueue<Record<string, never>>("payments-reconcile", {
  retryLimit: 0,
  expireInSeconds: 110,
  deleteAfterSeconds: 24 * 3600,
});

/** pg-boss cron for `reconcilePaymentsQueue`. */
export const RECONCILE_CRON = "*/2 * * * *";
