import { type Executor, schema } from "@commerce/db";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { logger } from "../../logger.ts";
import { defineJobHandler, enqueue } from "../jobs/index.ts";
import type { GatewayRegistry } from "./gateways/registry.ts";
import { GatewayUnavailableError } from "./gateways/types.ts";
import { paidCheckoutQueue, reconcilePaymentsQueue } from "./jobs.ts";
import {
  applyGatewayStatus,
  processRefundRequest,
  recordInitializeOutcome,
  recordRefundOutcome,
} from "./transactions.ts";

// The reconciliation job (ADR-0016 §6): what a lost webhook, a restart or an unreachable gateway
// left unfinished is finished here, every 2 minutes. Every step is idempotent and per item: one
// failing payment never stops the others.

/** How long work may stay in flight before the job looks at it (a webhook usually comes first). */
const SETTLE_AFTER_MS = 60_000;
/** A request the gateway never answered: nobody saw its page, so it can't be paid; closed after. */
const ABANDON_AFTER_MS = 30 * 60_000;
/** Paid checkouts without an order are retried this long, then left to staff. */
const COMPLETE_WITHIN_MS = 24 * 3600_000;

export type ReconcileReport = {
  paymentsRead: number;
  requestsAbandoned: number;
  refundsRetried: number;
  refundsRead: number;
  checkoutsQueued: number;
  failures: number;
};

const before = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** Runs `step` for each item, logging failures (unreachable gateways as warnings). */
async function each<T>(
  items: readonly T[],
  report: ReconcileReport,
  label: string,
  step: (item: T) => Promise<boolean>,
): Promise<number> {
  let done = 0;
  for (const item of items) {
    try {
      if (await step(item)) done += 1;
    } catch (error) {
      report.failures += 1;
      const level = error instanceof GatewayUnavailableError ? "warn" : "error";
      logger[level]({ err: error, item }, `Payment reconciliation: ${label} failed`);
    }
  }
  return done;
}

export async function reconcilePayments(
  db: Executor,
  gateways: GatewayRegistry,
  now: Date = new Date(),
): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    paymentsRead: 0,
    requestsAbandoned: 0,
    refundsRetried: 0,
    refundsRead: 0,
    checkoutsQueued: 0,
    failures: 0,
  };
  const tx = schema.paymentTransaction;
  const event = schema.paymentEvent;

  // 1. Payments the shopper may have paid: read them at the gateway (records success, failure,
  // cancellation or expiry, and queues the order).
  const waiting = await db
    .select({ id: tx.id })
    .from(tx)
    .where(
      and(
        sql`${tx.chargePendingAmount} > 0`,
        ne(tx.pspReference, ""),
        lt(tx.modifiedAt, before(now, SETTLE_AFTER_MS)),
      ),
    );
  report.paymentsRead = await each(waiting, report, "reading a payment", async ({ id }) => {
    await applyGatewayStatus(db, gateways, id);
    return true;
  });

  // 2. Requests the gateway never answered (a crash or an outage during transactionInitialize).
  const unanswered = await db
    .select({ id: tx.id })
    .from(tx)
    .where(
      and(
        sql`${tx.chargePendingAmount} > 0`,
        eq(tx.pspReference, ""),
        lt(tx.createdAt, before(now, ABANDON_AFTER_MS)),
      ),
    );
  report.requestsAbandoned = await each(unanswered, report, "closing a request", async ({ id }) => {
    await recordInitializeOutcome(db, id, {
      kind: "failure",
      message: "The payment was not started at the payment provider.",
    });
    return true;
  });

  // 3. Refund requests with no answer at all (the gateway was unreachable): ask again with the
  // same idempotency key.
  const unansweredRefunds = await db
    .select({ id: event.id, transactionId: event.transactionId })
    .from(event)
    .where(
      and(
        eq(event.type, "REFUND_REQUEST"),
        lt(event.createdAt, before(now, SETTLE_AFTER_MS)),
        sql`NOT EXISTS (SELECT 1 FROM payment_event AS answer
          WHERE answer.request_event_id = ${event.id})`,
      ),
    );
  report.refundsRetried = await each(
    unansweredRefunds,
    report,
    "retrying a refund",
    async (row) => {
      const { status } = await processRefundRequest(db, gateways, row.transactionId, row.id);
      return status !== "unavailable";
    },
  );

  // 4. Refunds the gateway accepted but hadn't finished (pending, or completed by hand at the
  // provider; recorded as an INFO answer): read them again where the gateway can tell.
  const pendingRefunds = await db
    .select({
      requestId: event.requestEventId,
      transactionId: event.transactionId,
      refundReference: event.pspReference,
      provider: tx.provider,
    })
    .from(event)
    .innerJoin(tx, eq(tx.id, event.transactionId))
    .where(
      and(
        // A refund the provider accepted but hadn't finished: an INFO answer to a REFUND_REQUEST.
        eq(event.type, "INFO"),
        ne(event.pspReference, ""),
        sql`EXISTS (SELECT 1 FROM payment_event AS request
          WHERE request.id = ${event.requestEventId} AND request.type = 'REFUND_REQUEST')`,
        sql`NOT EXISTS (SELECT 1 FROM payment_event AS answer
          WHERE answer.request_event_id = ${event.requestEventId}
            AND answer.type IN ('REFUND_SUCCESS', 'REFUND_FAILURE'))`,
      ),
    );
  report.refundsRead = await each(pendingRefunds, report, "reading a refund", async (row) => {
    const gateway = gateways.forTransaction(row.provider);
    if (!gateway?.fetchRefund || !row.requestId || !row.refundReference) return false;
    const result = await gateway.fetchRefund(row.refundReference);
    if (result.status !== "succeeded" && result.status !== "failed") return false;
    await recordRefundOutcome(db, row.transactionId, row.requestId, result);
    return true;
  });

  // 5. Checkouts holding a payment but no order (a lost job, or completion that kept failing):
  // queue their completion again; it is idempotent and refunds what can't become an order.
  const paidCheckouts = await db
    .selectDistinct({ checkoutId: tx.checkoutId })
    .from(tx)
    .where(
      and(
        sql`${tx.checkoutId} IS NOT NULL`,
        sql`${tx.chargedAmount} - ${tx.refundedAmount} - ${tx.refundPendingAmount} > 0`,
        lt(tx.modifiedAt, before(now, 2 * SETTLE_AFTER_MS)),
        gt(tx.modifiedAt, before(now, COMPLETE_WITHIN_MS)),
      ),
    );
  report.checkoutsQueued = await each(paidCheckouts, report, "queueing a checkout", async (row) => {
    if (row.checkoutId === null) return false;
    const checkoutId = row.checkoutId;
    await db.transaction((inner) => enqueue(inner, paidCheckoutQueue, { checkoutId }));
    return true;
  });

  if (report.failures > 0 || Object.values(report).some((count) => count > 0)) {
    logger.info(report, "Payment reconciliation");
  }
  return report;
}

/** The worker's handler for the scheduled run (src/worker.ts). */
export const createReconcileHandler = (gateways: GatewayRegistry) =>
  defineJobHandler(reconcilePaymentsQueue, async (_data, { db }) => {
    await reconcilePayments(db, gateways);
  });
