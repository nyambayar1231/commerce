import { addMoney, type CurrencyCode, type Money } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

// Payment transactions and their append-only events (ARCHITECTURE.md §3 "Payments"): Saleor's
// TransactionItem / TransactionEvent, processed by one built-in gateway — Saleor's dummy payment
// app (PLAN M5 decision 2). Real providers would be further gateways behind the same function
// (ARCHITECTURE §12). The caller owns the transaction and has already locked what it pays for
// (the checkout, M5.3), so these functions only write payment rows.

export type PaymentTransactionRow = typeof schema.paymentTransaction.$inferSelect;
export type PaymentEventRow = typeof schema.paymentEvent.$inferSelect;
export type PaymentEventType = (typeof schema.PAYMENT_EVENT_TYPES)[number];

/** Saleor's TransactionFlowStrategyEnum. */
export type TransactionAction = "AUTHORIZATION" | "CHARGE";

/** Saleor's dummy payment app identifier, the one gateway we have. */
export const DUMMY_GATEWAY_ID = "saleor.io.dummy-payment-app";
const DUMMY_GATEWAY_NAME = "Dummy payment";

export type TransactionInitializeErrorCode = "INVALID" | "NOT_FOUND" | "UNIQUE";

export type TransactionInitializeError = {
  field: string | null;
  code: TransactionInitializeErrorCode;
  message: string;
};

export type TransactionInitializeResult =
  | { ok: true; transaction: PaymentTransactionRow; event: PaymentEventRow }
  | { ok: false; errors: TransactionInitializeError[] };

export type CheckoutTransactionInput = {
  checkoutId: string;
  currency: string;
  /** Minor units, > 0. */
  amount: number;
  action: TransactionAction;
  gatewayId: string;
  /** Saleor's `paymentGateway.data`; the dummy gateway reads `{ event: { type } }`. */
  gatewayData: unknown;
  idempotencyKey: string;
};

const RESULT_TYPES: Record<TransactionAction, readonly PaymentEventType[]> = {
  AUTHORIZATION: ["AUTHORIZATION_SUCCESS", "AUTHORIZATION_FAILURE"],
  CHARGE: ["CHARGE_SUCCESS", "CHARGE_FAILURE"],
};

/**
 * Saleor's dummy payment app: succeeds by default; `data.event.type` picks the outcome
 * (e.g. `CHARGE_FAILURE`) so failures can be tried. The type must belong to the action.
 */
function dummyOutcome(
  action: TransactionAction,
  data: unknown,
): { ok: true; type: PaymentEventType } | { ok: false; error: TransactionInitializeError } {
  const allowed = RESULT_TYPES[action];
  const fallback = allowed[0];
  if (!fallback) throw new Error(`no result types for ${action}`);
  if (data === null || data === undefined) return { ok: true, type: fallback };

  const event = typeof data === "object" ? (data as { event?: unknown }).event : undefined;
  const type = event && typeof event === "object" ? (event as { type?: unknown }).type : undefined;
  if (type === undefined) return { ok: true, type: fallback };
  if (typeof type === "string" && (allowed as readonly string[]).includes(type)) {
    return { ok: true, type: type as PaymentEventType };
  }
  return {
    ok: false,
    error: {
      field: "paymentGateway",
      code: "INVALID",
      message: `The dummy gateway's event type must be one of: ${allowed.join(", ")}.`,
    },
  };
}

/** The first (initializing) event of a transaction. */
async function firstEvent(db: Executor, transactionId: string): Promise<PaymentEventRow> {
  const [event] = await db
    .select()
    .from(schema.paymentEvent)
    .where(eq(schema.paymentEvent.transactionId, transactionId))
    .orderBy(asc(schema.paymentEvent.createdAt), asc(schema.paymentEvent.id))
    .limit(1);
  if (!event) throw new Error(`payment transaction ${transactionId} has no event`);
  return event;
}

/**
 * Saleor's transactionInitialize for a checkout, with the dummy gateway: one transaction and its
 * outcome event (success moves the amount into authorized or charged; failure records 0). A retry
 * with the same idempotency key and the same request returns the first result; a different request
 * with that key is Saleor's UNIQUE error. Must run inside the caller's transaction.
 */
export async function createCheckoutTransaction(
  db: Executor,
  input: CheckoutTransactionInput,
): Promise<TransactionInitializeResult> {
  if (input.gatewayId !== DUMMY_GATEWAY_ID) {
    return {
      ok: false,
      errors: [
        {
          field: "paymentGateway",
          code: "NOT_FOUND",
          message: "App with provided identifier not found.",
        },
      ],
    };
  }
  const outcome = dummyOutcome(input.action, input.gatewayData);
  if (!outcome.ok) return { ok: false, errors: [outcome.error] };

  const [existing] = await db
    .select()
    .from(schema.paymentTransaction)
    .where(
      and(
        eq(schema.paymentTransaction.provider, input.gatewayId),
        eq(schema.paymentTransaction.idempotencyKey, input.idempotencyKey),
      ),
    );
  if (existing) {
    const event = await firstEvent(db, existing.id);
    const sameRequest =
      existing.checkoutId === input.checkoutId &&
      event.amount === input.amount &&
      RESULT_TYPES[input.action].includes(event.type as PaymentEventType);
    if (sameRequest) return { ok: true, transaction: existing, event };
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

  const succeeded = outcome.type.endsWith("_SUCCESS");
  const pspReference = succeeded ? `dummy-${crypto.randomUUID()}` : "";
  const [transaction] = await db
    .insert(schema.paymentTransaction)
    .values({
      checkoutId: input.checkoutId,
      provider: input.gatewayId,
      name: DUMMY_GATEWAY_NAME,
      pspReference,
      currency: input.currency,
      authorizedAmount: succeeded && input.action === "AUTHORIZATION" ? input.amount : 0,
      chargedAmount: succeeded && input.action === "CHARGE" ? input.amount : 0,
      idempotencyKey: input.idempotencyKey,
    })
    .returning();
  if (!transaction) throw new Error("payment transaction insert returned no row");

  const [event] = await db
    .insert(schema.paymentEvent)
    .values({
      transactionId: transaction.id,
      type: outcome.type,
      amount: input.amount,
      currency: input.currency,
      pspReference,
      message: succeeded ? "" : "The dummy gateway declined the payment.",
    })
    .returning();
  if (!event) throw new Error("payment event insert returned no row");
  return { ok: true, transaction, event };
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
