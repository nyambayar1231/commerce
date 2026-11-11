// Saleor's `order.Order`, `order.OrderLine` and `order.OrderEvent` (ARCHITECTURE.md §3 "Orders"),
// owned by the API's `orders` module. An order is a snapshot: lines copy names, SKU and prices,
// addresses are JSON copies, and totals are fixed at creation, so later catalog or checkout changes
// never alter it. Fulfillment tables arrive with M6.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariant } from "./catalog.ts";
import { user } from "./identity.ts";

/** Saleor's OrderStatus subset (ARCHITECTURE §3): UNFULFILLED → PARTIALLY_FULFILLED → FULFILLED, or CANCELED. */
export const ORDER_STATUSES = [
  "UNFULFILLED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELED",
] as const;

/** Saleor's OrderEvents values we record so far (more arrive with M6's lifecycle actions). */
export const ORDER_EVENT_TYPES = ["PLACED"] as const;

const inList = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    // Saleor's human-facing order number: 1, 2, 3… (gaps are possible after a rollback).
    number: bigint("number", { mode: "number" }).notNull().unique().generatedAlwaysAsIdentity(),
    status: text("status").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    userEmail: text("user_email").notNull(),
    billingAddress: jsonb("billing_address").notNull(),
    shippingAddress: jsonb("shipping_address").notNull(),
    shippingMethodName: text("shipping_method_name").notNull(),
    shippingPriceAmount: bigint("shipping_price_amount", { mode: "number" }).notNull(),
    subtotalAmount: bigint("subtotal_amount", { mode: "number" }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    // The completed checkout's id (its token, PLAN M5 decision 4). Unique: one order per checkout,
    // the database's guard behind idempotent completion (ARCHITECTURE §5.4).
    checkoutToken: uuid("checkout_token").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("order_status_known", sql.raw(`"status" IN (${inList(ORDER_STATUSES)})`)),
    check("order_shipping_price_not_negative", sql`${table.shippingPriceAmount} >= 0`),
    check("order_subtotal_not_negative", sql`${table.subtotalAmount} >= 0`),
    check(
      "order_total_is_subtotal_plus_shipping",
      sql`${table.totalAmount} = ${table.subtotalAmount} + ${table.shippingPriceAmount}`,
    ),
    index("order_user_id_idx").on(table.userId),
  ],
);

export const orderLine = pgTable(
  "order_line",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id),
    // The catalog row may go away; the line keeps its snapshot (ARCHITECTURE §6).
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    variantName: text("variant_name").notNull(),
    productSku: text("product_sku"),
    quantity: integer("quantity").notNull(),
    quantityFulfilled: integer("quantity_fulfilled").notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "number" }).notNull(),
    totalPriceAmount: bigint("total_price_amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("order_line_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "order_line_quantity_fulfilled_in_range",
      sql`${table.quantityFulfilled} >= 0 AND ${table.quantityFulfilled} <= ${table.quantity}`,
    ),
    check("order_line_unit_price_not_negative", sql`${table.unitPriceAmount} >= 0`),
    check(
      "order_line_total_is_unit_times_quantity",
      sql`${table.totalPriceAmount} = ${table.unitPriceAmount} * ${table.quantity}`,
    ),
    index("order_line_order_id_idx").on(table.orderId),
    index("order_line_variant_id_idx").on(table.variantId),
  ],
);

export const orderEvent = pgTable(
  "order_event",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id),
    type: text("type").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("order_event_type_known", sql.raw(`"type" IN (${inList(ORDER_EVENT_TYPES)})`)),
    index("order_event_order_id_idx").on(table.orderId),
  ],
);
