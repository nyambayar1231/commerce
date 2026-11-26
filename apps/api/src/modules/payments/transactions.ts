import { addMoney, type CurrencyCode, type Money } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { and, asc, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { logger } from "../../logger.ts";
import { enqueue } from "../jobs/index.ts";
import { MANUAL_GATEWAY_ID } from "./gateways/builtIn.ts";
import type { GatewayRegistry } from "./gateways/registry.ts";
import {
  GatewayUnavailableError,
  type InitializeResult,
  type PaymentGateway,
  type RefundResult,
  type TransactionAction,
} from "./gateways/types.ts";
import { paidCheckoutQueue } from "./jobs.ts";

// Payment transactions and their append-only events (ARCHITECTURE.md §3 "Payments"): Saleor's
// TransactionItem / TransactionEvent. A gateway (gateways/, ADR-0016) processes them; it may settle
// at once (the dummy gateway) or later, after the shopper paid on its page (Wire). Every call to a
// gateway is made between two database transactions: the request is recorded first, the gateway
// is called with an idempotency key taken from that record, and the answer is recorded after. A
// crash at any point leaves a request that a retry (same key) or the reconciliation job finishes
// without paying or refunding twice. Gateways are never called while a row lock is held.

export type PaymentTransactionRow = typeof schema.paymentTransaction.$inferSelect;
export type PaymentEventRow = typeof schema.paymentEvent.$inferSelect;
export type PaymentEventType = (typeof schema.PAYMENT_EVENT_TYPES)[number];
export type { TransactionAction };

export type TransactionInitializeErrorCode = "INVALID" | "NOT_FOUND" | "UNIQUE";

export type TransactionInitializeError = {
  field: string | null;
  code: TransactionInitializeErrorCode;
  message: string;
};

export type TransactionInitializeResult =
  | {
      ok: true;
      transaction: PaymentTransactionRow;
      /** The latest event: the outcome, or the request while the gateway hasn't answered. */
      event: PaymentEventRow;
      /** Saleor's TransactionInitialize.data: the gateway page the shopper must open, if any. */
      data: { url: string } | null;
    }
  | { ok: false; errors: TransactionInitializeError[] };

const EVENTS: Record<
  TransactionAction,
  {
    request: PaymentEventType;
    actionRequired: PaymentEventType;
    success: PaymentEventType;
    failure: PaymentEventType;
  }
> = {
  AUTHORIZATION: {
    request: "AUTHORIZATION_REQUEST",
    actionRequired: "AUTHORIZATION_ACTION_REQUIRED",
    success: "AUTHORIZATION_SUCCESS",
    failure: "AUTHORIZATION_FAILURE",
  },
  CHARGE: {
    request: "CHARGE_REQUEST",
    actionRequired: "CHARGE_ACTION_REQUIRED",
    success: "CHARGE_SUCCESS",
    failure: "CHARGE_FAILURE",
  },
};

const REQUEST_TYPES: readonly string[] = ["AUTHORIZATION_REQUEST", "CHARGE_REQUEST"];
/** Events that answer an initialize request (what a retry with the same key returns). */
const INITIALIZE_OUTCOMES: readonly string[] = [
  "AUTHORIZATION_ACTION_REQUIRED",
  "AUTHORIZATION_SUCCESS",
  "AUTHORIZATION_FAILURE",
  "CHARGE_ACTION_REQUIRED",
  "CHARGE_SUCCESS",
  "CHARGE_FAILURE",
];

const UNAVAILABLE_MESSAGE = "The payment provider is not available. Please try again.";

const actionOf = (request: PaymentEventRow): TransactionAction =>
  request.type === "AUTHORIZATION_REQUEST" ? "AUTHORIZATION" : "CHARGE";

/** A transaction's events, oldest first. */
async function eventsOf(db: Executor, transactionId: string): Promise<PaymentEventRow[]> {
  return db
    .select()
    .from(schema.paymentEvent)
    .where(eq(schema.paymentEvent.transactionId, transactionId))
    .orderBy(asc(schema.paymentEvent.createdAt), asc(schema.paymentEvent.id));
}

/** Locks one transaction `FOR UPDATE`; throws if it doesn't exist. */
async function lockTransaction(db: Executor, id: string): Promise<PaymentTransactionRow> {
  const [row] = await db
    .select()
    .from(schema.paymentTransaction)
    .where(eq(schema.paymentTransaction.id, id))
    .for("update");
  if (!row) throw new Error(`payment transaction ${id} does not exist`);
  return row;
}

async function insertEvent(
  db: Executor,
  values: typeof schema.paymentEvent.$inferInsert,
): Promise<PaymentEventRow> {
  const [event] = await db.insert(schema.paymentEvent).values(values).returning();
  if (!event) throw new Error("payment event insert returned no row");
  return event;
}

async function updateTransaction(
  db: Executor,
  id: string,
  values: PgUpdateSetSource<typeof schema.paymentTransaction>,
): Promise<PaymentTransactionRow> {
  const [row] = await db
    .update(schema.paymentTransaction)
    .set({ ...values, modifiedAt: sql`now()` })
    .where(eq(schema.paymentTransaction.id, id))
    .returning();
  if (!row) throw new Error(`payment transaction ${id} disappeared`);
  return row;
}

const initializeData = (
  transaction: PaymentTransactionRow,
  event: PaymentEventRow,
): { url: string } | null =>
  event.type.endsWith("_ACTION_REQUIRED") && transaction.externalUrl
    ? { url: transaction.externalUrl }
    : null;

// ── transactionInitialize ────────────────────────────────────────────────────────────────────

export type ChargeRequestInput = {
  checkoutId: string;
  currency: string;
  /** Minor units, > 0. */
  amount: number;
  action: TransactionAction;
  gateway: PaymentGateway;
  idempotencyKey: string;
};

export type ChargeRequestResult =
  | {
      ok: true;
      transaction: PaymentTransactionRow;
      request: PaymentEventRow;
      /** Set when this key was used before and the gateway already answered: return it. */
      outcome: PaymentEventRow | null;
    }
  | { ok: false; errors: TransactionInitializeError[] };

/**
 * Phase 1 of Saleor's transactionInitialize: the transaction and its request event (a charge
 * request also reserves the amount as pending). A retry with the same idempotency key and the
 * same request returns the first transaction (and its outcome, when there is one); a different
 * request with that key is Saleor's UNIQUE error. Runs inside the caller's database transaction,
 * which holds the checkout's lock.
 */
export async function recordInitializeRequest(
  db: Executor,
  input: ChargeRequestInput,
): Promise<ChargeRequestResult> {
  const [existing] = await db
    .select()
    .from(schema.paymentTransaction)
    .where(
      and(
        eq(schema.paymentTransaction.provider, input.gateway.id),
        eq(schema.paymentTransaction.idempotencyKey, input.idempotencyKey),
      ),
    );
  if (existing) {
    const events = await eventsOf(db, existing.id);
    const request = events.find((event) => REQUEST_TYPES.includes(event.type));
    const sameRequest =
      request !== undefined &&
      existing.checkoutId === input.checkoutId &&
      request.amount === input.amount &&
      actionOf(request) === input.action;
    if (!sameRequest) {
      return {
        ok: false,
        errors: [
          {
            field: "idempotencyKey",
            code: "UNIQUE",
            message: "Different transaction with provided idempotency key already exists.",
          },
        ],
      };
    }
    const outcome = events.find((event) => INITIALIZE_OUTCOMES.includes(event.type)) ?? null;
    return { ok: true, transaction: existing, request, outcome };
  }

  const [transaction] = await db
    .insert(schema.paymentTransaction)
    .values({
      checkoutId: input.checkoutId,
      provider: input.gateway.id,
      name: input.gateway.name,
      currency: input.currency,
      chargePendingAmount: input.action === "CHARGE" ? input.amount : 0,
      idempotencyKey: input.idempotencyKey,
    })
    .returning();
  if (!transaction) throw new Error("payment transaction insert returned no row");
  const request = await insertEvent(db, {
    transactionId: transaction.id,
    type: EVENTS[input.action].request,
    amount: input.amount,
    currency: input.currency,
  });
  return { ok: true, transaction, request, outcome: null };
}

/**
 * Phase 3 of transactionInitialize: records the gateway's answer to `request` once. A second call
 * (a retry that reached the gateway again) returns the outcome already recorded. A
 * GatewayUnavailableError from phase 2 is recorded as a failure the shopper can retry with a new
 * attempt: nobody was shown the gateway's page, so nothing can be paid on it.
 */
export async function recordInitializeOutcome(
  db: Executor,
  transactionId: string,
  result: InitializeResult | { kind: "unavailable" },
): Promise<{ transaction: PaymentTransactionRow; event: PaymentEventRow }> {
  return db.transaction(async (tx) => {
    const transaction = await lockTransaction(tx, transactionId);
    const events = await eventsOf(tx, transactionId);
    const request = events.find((event) => REQUEST_TYPES.includes(event.type));
    if (!request) throw new Error(`payment transaction ${transactionId} has no request`);
    const recorded = events.find((event) => INITIALIZE_OUTCOMES.includes(event.type));
    if (recorded) return { transaction, event: recorded };

    const action = actionOf(request);
    const types = EVENTS[action];
    const pending = action === "CHARGE" ? request.amount : 0;
    const base = {
      transactionId,
      amount: request.amount,
      currency: request.currency,
      requestEventId: null,
    };
    if (result.kind === "success") {
      const updated = await updateTransaction(tx, transactionId, {
        pspReference: result.pspReference,
        chargePspReference: result.chargeReference ?? "",
        ...(action === "CHARGE"
          ? {
              chargedAmount: sql`${schema.paymentTransaction.chargedAmount} + ${request.amount}`,
              chargePendingAmount: sql`${schema.paymentTransaction.chargePendingAmount} - ${pending}`,
            }
          : {
              authorizedAmount: sql`${schema.paymentTransaction.authorizedAmount} + ${request.amount}`,
            }),
      });
      const event = await insertEvent(tx, {
        ...base,
        type: types.success,
        pspReference: result.pspReference,
      });
      if (action === "CHARGE" && updated.checkoutId !== null) {
        await enqueue(tx, paidCheckoutQueue, { checkoutId: updated.checkoutId });
      }
      return { transaction: updated, event };
    }
    if (result.kind === "action_required") {
      const updated = await updateTransaction(tx, transactionId, {
        pspReference: result.pspReference,
        externalUrl: result.url,
      });
      const event = await insertEvent(tx, {
        ...base,
        type: types.actionRequired,
        pspReference: result.pspReference,
        externalUrl: result.url,
      });
      return { transaction: updated, event };
    }
    const updated = await updateTransaction(tx, transactionId, {
      ...(result.kind === "failure" && result.pspReference
        ? { pspReference: result.pspReference }
        : {}),
      chargePendingAmount: sql`${schema.paymentTransaction.chargePendingAmount} - ${pending}`,
    });
    const event = await insertEvent(tx, {
      ...base,
      // A failure answer records 0 as before (M5.3): nothing was taken.
      amount: 0,
      type: types.failure,
      pspReference: result.kind === "failure" ? (result.pspReference ?? "") : "",
      message: result.kind === "failure" ? result.message : UNAVAILABLE_MESSAGE,
    });
    return { transaction: updated, event };
  });
}

/**
 * Phases 2 and 3 for a request recorded by `recordInitializeRequest`: asks the gateway (with our
 * transaction id as its idempotency key) and records the answer. Called outside any database
 * transaction.
 */
export async function processInitializeRequest(
  db: Executor,
  gateway: PaymentGateway,
  transaction: PaymentTransactionRow,
  request: PaymentEventRow,
  input: { gatewayData: unknown; returnUrl: string | null },
): Promise<Extract<TransactionInitializeResult, { ok: true }>> {
  let result: InitializeResult | { kind: "unavailable" };
  try {
    result = await gateway.initialize({
      transactionId: transaction.id,
      amount: request.amount,
      currency: request.currency,
      action: actionOf(request),
      gatewayData: input.gatewayData,
      returnUrl: input.returnUrl,
    });
  } catch (error) {
    if (!(error instanceof GatewayUnavailableError)) throw error;
    logger.warn({ err: error, transactionId: transaction.id }, "Payment gateway unavailable");
    result = { kind: "unavailable" };
  }
  const recorded = await recordInitializeOutcome(db, transaction.id, result);
  return {
    ok: true,
    transaction: recorded.transaction,
    event: recorded.event,
    data: initializeData(recorded.transaction, recorded.event),
  };
}

/** The answer for a request whose outcome was recorded before (an idempotent retry). */
export function initializeReplay(
  transaction: PaymentTransactionRow,
  outcome: PaymentEventRow,
): Extract<TransactionInitializeResult, { ok: true }> {
  return { ok: true, transaction, event: outcome, data: initializeData(transaction, outcome) };
}

// ── Gateway status (webhooks, the return page, the reconciliation job) ───────────────────────

export type ApplyStatusResult = {
  transaction: PaymentTransactionRow;
  /** True when a new event was recorded. */
  changed: boolean;
};

/**
 * Reads a transaction's payment at its gateway and records what changed, once (Saleor's
 * transactionEventReport, ADR-0016 §3). Safe to call any number of times and concurrently: the
 * decision is made under the transaction's lock from what is already recorded.
 * - succeeded → CHARGE_SUCCESS with the amount the gateway reports (a different amount than asked
 *   is still money received: recorded as it is and logged; the checkout's status shows the gap);
 * - failed → CHARGE_FAILURE, canceled → CANCEL_SUCCESS (the pending amount is released);
 * - pending → CHARGE_PENDING once; action_required → nothing yet.
 * A payment that succeeds after we recorded a failure (paid on a page we tried to cancel) is
 * still recorded as charged: the money is real.
 */
export async function applyGatewayStatus(
  db: Executor,
  gateways: GatewayRegistry,
  transactionId: string,
): Promise<ApplyStatusResult> {
  const current = await getTransaction(db, transactionId);
  if (!current) throw new Error(`payment transaction ${transactionId} does not exist`);
  if (current.pspReference === "") return { transaction: current, changed: false };
  const gateway = gateways.forTransaction(current.provider);
  if (!gateway)
    throw new Error(`no gateway "${current.provider}" for transaction ${transactionId}`);
  const status = await gateway.fetchStatus(current.pspReference);

  return db.transaction(async (tx) => {
    const transaction = await lockTransaction(tx, transactionId);
    const events = await eventsOf(tx, transactionId);
    const request = events.find((event) => event.type === "CHARGE_REQUEST");
    if (!request) return { transaction, changed: false };
    const has = (type: PaymentEventType) => events.some((event) => event.type === type);
    const base = { transactionId, currency: transaction.currency, requestEventId: null };

    if (status.status === "succeeded") {
      if (has("CHARGE_SUCCESS")) return { transaction, changed: false };
      if (status.amount !== request.amount) {
        logger.error(
          { transactionId, requested: request.amount, paid: status.amount },
          "Payment gateway reports a different paid amount than requested",
        );
      }
      const updated = await updateTransaction(tx, transactionId, {
        chargedAmount: sql`${schema.paymentTransaction.chargedAmount} + ${status.amount}`,
        chargePendingAmount: sql`0`,
        chargePspReference: status.chargeReference ?? "",
      });
      await insertEvent(tx, {
        ...base,
        type: "CHARGE_SUCCESS",
        amount: status.amount,
        pspReference: transaction.pspReference,
      });
      // The order is made by the server, not the shopper's browser (ADR-0016 §5): the job exists
      // exactly when this payment does.
      if (updated.checkoutId !== null) {
        await enqueue(tx, paidCheckoutQueue, { checkoutId: updated.checkoutId });
      } else if (updated.orderId !== null) {
        // An older attempt paid after the order was made: the order may now be overpaid.
        await enqueue(tx, paidCheckoutQueue, { orderId: updated.orderId });
      }
      return { transaction: updated, changed: true };
    }
    if (status.status === "failed" || status.status === "canceled") {
      if (transaction.chargePendingAmount === 0) return { transaction, changed: false };
      const updated = await updateTransaction(tx, transactionId, { chargePendingAmount: sql`0` });
      await insertEvent(tx, {
        ...base,
        type: status.status === "failed" ? "CHARGE_FAILURE" : "CANCEL_SUCCESS",
        amount: 0,
        pspReference: transaction.pspReference,
        message: status.message,
      });
      return { transaction: updated, changed: true };
    }
    if (
      status.status === "pending" &&
      !has("CHARGE_PENDING") &&
      transaction.chargePendingAmount > 0
    ) {
      await insertEvent(tx, {
        ...base,
        type: "CHARGE_PENDING",
        amount: transaction.chargePendingAmount,
        pspReference: transaction.pspReference,
      });
      return { transaction, changed: true };
    }
    return { transaction, changed: false };
  });
}

/** A checkout's attempts still waiting for the shopper or the gateway, oldest first. */
export async function getOpenCheckoutAttempts(
  db: Executor,
  checkoutId: string,
): Promise<PaymentTransactionRow[]> {
  return db
    .select()
    .from(schema.paymentTransaction)
    .where(
      and(
        eq(schema.paymentTransaction.checkoutId, checkoutId),
        sql`${schema.paymentTransaction.chargePendingAmount} > 0`,
      ),
    )
    .orderBy(asc(schema.paymentTransaction.createdAt), asc(schema.paymentTransaction.id));
}

/**
 * Before a new payment attempt: cancels the checkout's older attempts at their gateway, so the
 * shopper can't pay twice, and records their final state (one of them may turn out paid; then the
 * new attempt asks only for what is left). An attempt whose gateway never answered is left alone
 * while it is young (its request may still be in flight); the reconciliation job settles it.
 * Gateway failures are logged, not thrown: a payment that slips through is shown as
 * OVERCHARGED and refunded (M16.2b).
 */
export async function cancelOpenAttempts(
  db: Executor,
  gateways: GatewayRegistry,
  checkoutId: string,
  exceptIdempotencyKey: string,
): Promise<void> {
  for (const attempt of await getOpenCheckoutAttempts(db, checkoutId)) {
    if (attempt.idempotencyKey === exceptIdempotencyKey || attempt.pspReference === "") continue;
    const gateway = gateways.forTransaction(attempt.provider);
    if (!gateway) continue;
    try {
      await gateway.cancel(attempt.pspReference);
      await applyGatewayStatus(db, gateways, attempt.id);
    } catch (error) {
      logger.warn(
        { err: error, transactionId: attempt.id },
        "Could not cancel an earlier payment attempt",
      );
    }
  }
}

/** The transactions of the given checkouts, oldest first. One query for any number of ids. */
export async function getTransactionsByCheckoutIds(
  db: Executor,
  checkoutIds: readonly string[],
): Promise<PaymentTransactionRow[]> {
  if (checkoutIds.length === 0) return [];
  return db
    .select()
    .from(schema.paymentTransaction)
    .where(inArray(schema.paymentTransaction.checkoutId, [...checkoutIds]))
    .orderBy(asc(schema.paymentTransaction.createdAt), asc(schema.paymentTransaction.id));
}

/** The events of the given transactions, oldest first. One query for any number of ids. */
export async function getEventsByTransactionIds(
  db: Executor,
  transactionIds: readonly string[],
): Promise<PaymentEventRow[]> {
  if (transactionIds.length === 0) return [];
  return db
    .select()
    .from(schema.paymentEvent)
    .where(inArray(schema.paymentEvent.transactionId, [...transactionIds]))
    .orderBy(asc(schema.paymentEvent.createdAt), asc(schema.paymentEvent.id));
}

/**
 * Saleor's `_get_payment_amount_for_checkout`: what the transactions cover, as Money in `currency`.
 * `addMoney` rejects a transaction in another currency instead of mixing amounts.
 */
export function coveredAmounts(
  transactions: readonly PaymentTransactionRow[],
  currency: CurrencyCode,
): { authorized: Money; charged: Money } {
  let authorized: Money = { amountMinor: 0, currency };
  let charged: Money = { amountMinor: 0, currency };
  for (const transaction of transactions) {
    const transactionCurrency = transaction.currency as CurrencyCode;
    authorized = addMoney(authorized, {
      amountMinor: transaction.authorizedAmount,
      currency: transactionCurrency,
    });
    charged = addMoney(charged, {
      amountMinor: transaction.chargedAmount,
      currency: transactionCurrency,
    });
  }
  return { authorized, charged };
}

/**
 * Checkout completion's last payment step (ARCHITECTURE §5.4 step 8): the checkout's transactions
 * now belong to the order. Must run inside the completion's transaction.
 */
export async function moveCheckoutTransactionsToOrder(
  db: Executor,
  checkoutId: string,
  orderId: string,
): Promise<void> {
  await db
    .update(schema.paymentTransaction)
    .set({ checkoutId: null, orderId, modifiedAt: sql`now()` })
    .where(eq(schema.paymentTransaction.checkoutId, checkoutId));
}

/** The transactions of the given orders, oldest first. One query for any number of ids. */
export async function getTransactionsByOrderIds(
  db: Executor,
  orderIds: readonly string[],
): Promise<PaymentTransactionRow[]> {
  if (orderIds.length === 0) return [];
  return db
    .select()
    .from(schema.paymentTransaction)
    .where(inArray(schema.paymentTransaction.orderId, [...orderIds]))
    .orderBy(asc(schema.paymentTransaction.createdAt), asc(schema.paymentTransaction.id));
}

/**
 * For the orders list's payment sort: an order's net charged amount (charged − refunded over its
 * transactions, Saleor's `total_charged`) as a SQL subquery on the given order id expression. The
 * payments module owns `payment_transaction`, so other modules get its SQL from here.
 */
export function orderNetChargedSql(orderId: SQL): SQL {
  return sql`(SELECT COALESCE(sum(t.charged_amount - t.refunded_amount), 0)
    FROM payment_transaction AS t WHERE t.order_id = ${orderId})`;
}

// ── Order-side actions (M6.4) ────────────────────────────────────────────────────────────────
// The orders module composes these under its own lock order: order → its transactions → stocks
// (PLAN M6 decision 8). They only write payment rows.

/** Saleor's MARK_AS_PAID transactions: processed by the manual gateway (gateways/builtIn.ts). */
export const MANUAL_PROVIDER = MANUAL_GATEWAY_ID;
const MARK_AS_PAID_TRANSACTION_NAME = "Mark-as-paid transaction";

/** A transaction's charge that hasn't been refunded (Saleor's `charged_value`). */
export const netCharged = (transaction: PaymentTransactionRow): number =>
  transaction.chargedAmount - transaction.refundedAmount;

/** What can still be refunded: charged, minus refunded and refunds in flight (reserved). */
export const refundableAmount = (transaction: PaymentTransactionRow): number =>
  transaction.chargedAmount - transaction.refundedAmount - transaction.refundPendingAmount;

/**
 * Saleor's TransactionItem.actions for our gateways: REFUND while something charged is left that
 * no refund in flight has reserved. Charge and cancel are not offered to staff.
 */
export function transactionActions(transaction: PaymentTransactionRow): "REFUND"[] {
  return refundableAmount(transaction) > 0 ? ["REFUND"] : [];
}

export async function getTransaction(
  db: Executor,
  id: string,
): Promise<PaymentTransactionRow | null> {
  const [row] = await db
    .select()
    .from(schema.paymentTransaction)
    .where(eq(schema.paymentTransaction.id, id));
  return row ?? null;
}

/** A checkout's transactions, locked `FOR UPDATE` in id order. The caller holds its lock. */
export async function lockCheckoutTransactions(
  db: Executor,
  checkoutId: string,
): Promise<PaymentTransactionRow[]> {
  return db
    .select()
    .from(schema.paymentTransaction)
    .where(eq(schema.paymentTransaction.checkoutId, checkoutId))
    .orderBy(asc(schema.paymentTransaction.id))
    .for("update");
}

/** An order's transactions, locked `FOR UPDATE` in id order. The caller holds the order's lock. */
export async function lockOrderTransactions(
  db: Executor,
  orderId: string,
): Promise<PaymentTransactionRow[]> {
  return db
    .select()
    .from(schema.paymentTransaction)
    .where(eq(schema.paymentTransaction.orderId, orderId))
    .orderBy(asc(schema.paymentTransaction.id))
    .for("update");
}

/**
 * Saleor's create_transaction_for_order for orderMarkAsPaid (PLAN M6 decision 5): a manual
 * transaction charged with `amount`, its CHARGE_SUCCESS event, and the staff's reference as the
 * PSP reference. Must run inside the caller's transaction.
 */
export async function createManualOrderTransaction(
  db: Executor,
  input: { orderId: string; amount: number; currency: string; pspReference: string },
): Promise<PaymentTransactionRow> {
  const [transaction] = await db
    .insert(schema.paymentTransaction)
    .values({
      orderId: input.orderId,
      provider: MANUAL_PROVIDER,
      name: MARK_AS_PAID_TRANSACTION_NAME,
      pspReference: input.pspReference,
      currency: input.currency,
      chargedAmount: input.amount,
      idempotencyKey: crypto.randomUUID(),
    })
    .returning();
  if (!transaction) throw new Error("payment transaction insert returned no row");
  await db.insert(schema.paymentEvent).values({
    transactionId: transaction.id,
    type: "CHARGE_SUCCESS",
    amount: input.amount,
    currency: input.currency,
    pspReference: input.pspReference,
  });
  return transaction;
}

// ── Refunds (transactionRequestAction(REFUND), ADR-0016 §8) ─────────────────────────────────

/**
 * Phase 1 of a refund: the REFUND_REQUEST event, with `amount` reserved as pending so concurrent
 * refunds can never exceed the charge (the CHECK on refunded + pending ≤ charged is the last
 * guard). The caller holds the transaction's lock and checked `0 < amount ≤ refundableAmount`.
 */
export async function recordRefundRequest(
  db: Executor,
  transaction: PaymentTransactionRow,
  amount: number,
  message = "",
): Promise<{ transaction: PaymentTransactionRow; request: PaymentEventRow }> {
  if (amount <= 0 || amount > refundableAmount(transaction)) {
    throw new Error(`refund of ${amount} is outside the transaction's refundable amount`);
  }
  const request = await insertEvent(db, {
    transactionId: transaction.id,
    type: "REFUND_REQUEST",
    amount,
    currency: transaction.currency,
    message,
  });
  const updated = await updateTransaction(db, transaction.id, {
    refundPendingAmount: sql`${schema.paymentTransaction.refundPendingAmount} + ${amount}`,
  });
  return { transaction: updated, request };
}

const MANUAL_REFUND_MESSAGE = "The refund is completed manually by the payment provider.";

/**
 * Phase 3 of a refund: records the gateway's answer to `requestEventId` once (a second call is a
 * no-op). Succeeded moves the amount from pending to refunded; failed releases it; pending and
 * manual_required keep it reserved (REFUND_PENDING, recorded once) until a later answer settles it.
 */
export async function recordRefundOutcome(
  db: Executor,
  transactionId: string,
  requestEventId: string,
  result: RefundResult,
): Promise<{ transaction: PaymentTransactionRow; event: PaymentEventRow | null }> {
  return db.transaction(async (tx) => {
    const transaction = await lockTransaction(tx, transactionId);
    const events = await eventsOf(tx, transactionId);
    const request = events.find(
      (event) => event.id === requestEventId && event.type === "REFUND_REQUEST",
    );
    if (!request) throw new Error(`refund request ${requestEventId} is not on ${transactionId}`);
    const answers = events.filter((event) => event.requestEventId === requestEventId);
    if (
      answers.some((event) => event.type === "REFUND_SUCCESS" || event.type === "REFUND_FAILURE")
    ) {
      return { transaction, event: null };
    }
    const base = {
      transactionId,
      currency: request.currency,
      pspReference: result.refundReference,
      requestEventId,
    };
    if (result.status === "succeeded") {
      const updated = await updateTransaction(tx, transactionId, {
        refundedAmount: sql`${schema.paymentTransaction.refundedAmount} + ${request.amount}`,
        refundPendingAmount: sql`${schema.paymentTransaction.refundPendingAmount} - ${request.amount}`,
      });
      const event = await insertEvent(tx, {
        ...base,
        type: "REFUND_SUCCESS",
        amount: request.amount,
      });
      return { transaction: updated, event };
    }
    if (result.status === "failed") {
      const updated = await updateTransaction(tx, transactionId, {
        refundPendingAmount: sql`${schema.paymentTransaction.refundPendingAmount} - ${request.amount}`,
      });
      const event = await insertEvent(tx, {
        ...base,
        type: "REFUND_FAILURE",
        amount: request.amount,
        message: result.message,
      });
      return { transaction: updated, event };
    }
    if (answers.some((event) => event.type === "REFUND_PENDING"))
      return { transaction, event: null };
    const event = await insertEvent(tx, {
      ...base,
      type: "REFUND_PENDING",
      amount: request.amount,
      message: result.status === "manual_required" ? MANUAL_REFUND_MESSAGE : result.message,
    });
    return { transaction, event };
  });
}

/**
 * Phases 2 and 3 of a refund: asks the transaction's gateway (our request event id is the
 * idempotency key) and records the answer. When the gateway is unreachable nothing is recorded:
 * the amount stays reserved and the reconciliation job asks again with the same key. Called
 * outside any database transaction.
 */
export async function processRefundRequest(
  db: Executor,
  gateways: GatewayRegistry,
  transactionId: string,
  requestEventId: string,
  reason = "",
): Promise<{ transaction: PaymentTransactionRow; status: RefundResult["status"] | "unavailable" }> {
  const transaction = await getTransaction(db, transactionId);
  if (!transaction) throw new Error(`payment transaction ${transactionId} does not exist`);
  const [request] = await db
    .select()
    .from(schema.paymentEvent)
    .where(eq(schema.paymentEvent.id, requestEventId));
  if (!request) throw new Error(`refund request ${requestEventId} does not exist`);
  const gateway = gateways.forTransaction(transaction.provider);
  if (!gateway) throw new Error(`no gateway "${transaction.provider}" to refund ${transactionId}`);

  let result: RefundResult;
  try {
    result = await gateway.refund({
      pspReference: transaction.pspReference,
      chargeReference: transaction.chargePspReference || null,
      amount: request.amount,
      currency: request.currency,
      idempotencyKey: requestEventId,
      reason,
    });
  } catch (error) {
    if (!(error instanceof GatewayUnavailableError)) throw error;
    logger.warn({ err: error, transactionId, requestEventId }, "Refund gateway unavailable");
    return { transaction, status: "unavailable" };
  }
  const recorded = await recordRefundOutcome(db, transactionId, requestEventId, result);
  return { transaction: recorded.transaction, status: result.status };
}
