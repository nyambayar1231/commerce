// Saleor's `payment.TransactionItem` and `payment.TransactionEvent` (ARCHITECTURE.md §3 "Payments"),
// with far fewer states: no pending, canceled or charge-back amounts yet. Owned by the API's
// `payments` module. A transaction belongs to a checkout *or* an order; completion (M5.4) moves it
// from one to the other. Events are append-only: the
// migration adds a trigger that rejects UPDATE and DELETE on `payment_event`.
import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
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
    /** Saleor's idempotency key: a retried initialize with the same key returns this transaction. */
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("payment_transaction_authorized_not_negative", sql`${table.authorizedAmount} >= 0`),
    check("payment_transaction_charged_not_negative", sql`${table.chargedAmount} >= 0`),
    check("payment_transaction_refunded_not_negative", sql`${table.refundedAmount} >= 0`),
    // No refunding more than was charged (ARCHITECTURE §3 "Payments").
    check(
      "payment_transaction_refunded_not_greater_than_charged",
      sql`${table.refundedAmount} <= ${table.chargedAmount}`,
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

// Saleor's TransactionEventTypeEnum values our gateway can record (the rest arrive with refunds,
// cancellation and real providers).
export const PAYMENT_EVENT_TYPES = [
  "AUTHORIZATION_SUCCESS",
  "AUTHORIZATION_FAILURE",
  "CHARGE_SUCCESS",
  "CHARGE_FAILURE",
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("payment_event_amount_not_negative", sql`${table.amount} >= 0`),
    check(
      "payment_event_type_known",
      sql.raw(`"type" IN (${PAYMENT_EVENT_TYPES.map((type) => `'${type}'`).join(", ")})`),
    ),
    index("payment_event_transaction_id_idx").on(table.transactionId),
  ],
);
