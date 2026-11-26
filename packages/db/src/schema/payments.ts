// Saleor's `payment.TransactionItem` and `payment.TransactionEvent` (ARCHITECTURE.md §3 "Payments"),
// with fewer states: pending charge and refund amounts (ADR-0016), no canceled or charge-back
// amounts. Owned by the API's
// `payments` module. A transaction belongs to a checkout *or* an order; completion (M5.4) moves it
// from one to the other. Events are append-only: the migration adds a trigger that rejects UPDATE
// and DELETE on `payment_event`.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { checkout } from "./checkout.ts";
import { order } from "./orders.ts";

export const paymentTransaction = pgTable(
  "payment_transaction",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    // No ON DELETE action: a checkout with payments can't be deleted (its money must stay traceable).
    checkoutId: uuid("checkout_id").references(() => checkout.id),
    orderId: uuid("order_id").references(() => order.id),
    /** The gateway that processed it, e.g. Saleor's dummy payment app identifier. */
    provider: text("provider").notNull(),
    /** Saleor's TransactionItem.name, shown to staff. */
    name: text("name").notNull(),
    pspReference: text("psp_reference").notNull().default(""),
    currency: text("currency").notNull(),
    authorizedAmount: bigint("authorized_amount", { mode: "number" }).notNull().default(0),
    chargedAmount: bigint("charged_amount", { mode: "number" }).notNull().default(0),
    refundedAmount: bigint("refunded_amount", { mode: "number" }).notNull().default(0),
    /** Saleor's charge_pending_value: requested from the gateway, not yet charged or failed. */
    chargePendingAmount: bigint("charge_pending_amount", { mode: "number" }).notNull().default(0),
    /** Saleor's refund_pending_value: refunds requested and not yet settled; reserved. */
    refundPendingAmount: bigint("refund_pending_amount", { mode: "number" }).notNull().default(0),
    /** The gateway's reference of the charge, when it differs from `pspReference` (Wire refunds
     * a charge, not a payment intent). */
    chargePspReference: text("charge_psp_reference").notNull().default(""),
    /** Saleor's TransactionItem.externalUrl: the gateway's page for this payment. */
    externalUrl: text("external_url").notNull().default(""),
    /** Saleor's idempotency key: a retried initialize with the same key returns this transaction. */
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("payment_transaction_authorized_not_negative", sql`${table.authorizedAmount} >= 0`),
    check("payment_transaction_charged_not_negative", sql`${table.chargedAmount} >= 0`),
    check("payment_transaction_refunded_not_negative", sql`${table.refundedAmount} >= 0`),
    check(
      "payment_transaction_charge_pending_not_negative",
      sql`${table.chargePendingAmount} >= 0`,
    ),
    check(
      "payment_transaction_refund_pending_not_negative",
      sql`${table.refundPendingAmount} >= 0`,
    ),
    // No refunding more than was charged, counting refunds still pending (ARCHITECTURE §3
    // "Payments", ADR-0016): two refunds in flight can never exceed the charge.
    check(
      "payment_transaction_refunded_not_greater_than_charged",
      sql`${table.refundedAmount} + ${table.refundPendingAmount} <= ${table.chargedAmount}`,
    ),
    // Owned by exactly one of a checkout or an order.
    check(
      "payment_transaction_one_owner",
      sql`num_nonnulls(${table.checkoutId}, ${table.orderId}) = 1`,
    ),
    unique("payment_transaction_provider_idempotency_key_unique").on(
      table.provider,
      table.idempotencyKey,
    ),
    index("payment_transaction_checkout_id_idx").on(table.checkoutId),
    index("payment_transaction_order_id_idx").on(table.orderId),
  ],
);

// Saleor's TransactionEventTypeEnum values our gateways can record: authorize/charge requests and
// outcomes (a real gateway may first need the shopper: CHARGE_ACTION_REQUIRED, ADR-0016), the
// manual mark-as-paid charge, refunds (REFUND_REQUEST, then SUCCESS, FAILURE or PENDING) and the
// cancellation of an unpaid attempt.
export const PAYMENT_EVENT_TYPES = [
  "AUTHORIZATION_REQUEST",
  "AUTHORIZATION_ACTION_REQUIRED",
  "AUTHORIZATION_SUCCESS",
  "AUTHORIZATION_FAILURE",
  "CHARGE_REQUEST",
  "CHARGE_ACTION_REQUIRED",
  "CHARGE_PENDING",
  "CHARGE_SUCCESS",
  "CHARGE_FAILURE",
  "REFUND_REQUEST",
  "REFUND_PENDING",
  "REFUND_SUCCESS",
  "REFUND_FAILURE",
  "CANCEL_SUCCESS",
] as const;

export const paymentEvent = pgTable(
  "payment_event",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => paymentTransaction.id),
    type: text("type").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    pspReference: text("psp_reference").notNull().default(""),
    message: text("message").notNull().default(""),
    /** Saleor's TransactionEvent.externalUrl, e.g. the gateway's payment page. */
    externalUrl: text("external_url").notNull().default(""),
    /** For an outcome event (REFUND_SUCCESS, …): the REFUND_REQUEST it settles. */
    requestEventId: uuid("request_event_id").references((): AnyPgColumn => paymentEvent.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("payment_event_amount_not_negative", sql`${table.amount} >= 0`),
    // One settling outcome per request (a retried webhook or job can't settle it twice); a
    // REFUND_PENDING may precede it.
    uniqueIndex("payment_event_request_settled_unique")
      .on(table.requestEventId)
      .where(sql`${table.type} IN ('REFUND_SUCCESS', 'REFUND_FAILURE')`),
    index("payment_event_request_event_id_idx").on(table.requestEventId),
    check(
      "payment_event_type_known",
      sql.raw(`"type" IN (${PAYMENT_EVENT_TYPES.map((type) => `'${type}'`).join(", ")})`),
    ),
    index("payment_event_transaction_id_idx").on(table.transactionId),
  ],
);

/**
 * Every notification a gateway sent us, kept as received (ADR-0016 §4): the payment contract's
 * evidence (1 year, kept in the backed-up database) and the source for reprocessing. A redelivery
 * of the same event is one row (unique provider + external id).
 */
export const paymentGatewayEvent = pgTable(
  "payment_gateway_event",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    type: text("type").notNull(),
    rawBody: text("raw_body").notNull(),
    signature: text("signature").notNull().default(""),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error").notNull().default(""),
  },
  (table) => [
    unique("payment_gateway_event_provider_external_id_unique").on(
      table.provider,
      table.externalEventId,
    ),
    index("payment_gateway_event_unprocessed_idx")
      .on(table.receivedAt)
      .where(sql`${table.processedAt} IS NULL`),
  ],
);
