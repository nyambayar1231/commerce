// Saleor's `checkout.Checkout` and `checkout.CheckoutLine` (ARCHITECTURE.md §3 "Checkout"). Owned
// by the API's `checkout` module. A checkout holds no stored prices: totals are always computed
// from the current variant prices (§5.2).
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariant } from "./catalog.ts";
import { user } from "./identity.ts";

// A flat list of shipping methods (PLAN M5 decision 1): Saleor's ShippingMethod without its zone,
// channel listings, postal-code or weight rules. The price lives on the row (single channel), as a
// variant's does (ADR-0013); staff can switch a method off without deleting it.
export const shippingMethod = pgTable(
  "shipping_method",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    priceAmount: integer("price_amount").notNull(),
    currency: text("currency").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("shipping_method_name_not_empty", sql`${table.name} <> ''`),
    check("shipping_method_price_not_negative", sql`${table.priceAmount} >= 0`),
  ],
);

// The id is a random v4 UUID (PLAN M5 decision 4): it doubles as Saleor's checkout token, so it
// must be unguessable — unlike the time-ordered uuidv7() every other table uses. Addresses are
// JSON snapshots (ARCHITECTURE §3), validated by the checkout module. A deleted shipping method
// leaves the checkout without one. `completed_order_id` gets its foreign key with orders (M5.4).
export const checkout = pgTable("checkout", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  email: text("email"),
  shippingAddress: jsonb("shipping_address"),
  billingAddress: jsonb("billing_address"),
  shippingMethodId: uuid("shipping_method_id").references(() => shippingMethod.id, {
    onDelete: "set null",
  }),
  currency: text("currency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedOrderId: uuid("completed_order_id"),
});

// Saleor's CheckoutLine. One row per (checkout, variant): adding a variant already in the cart
// increases its quantity instead of creating a second line.
export const checkoutLine = pgTable(
  "checkout_line",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    checkoutId: uuid("checkout_id")
      .notNull()
      .references(() => checkout.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("checkout_line_checkout_id_variant_id_unique").on(table.checkoutId, table.variantId),
    check("checkout_line_quantity_positive", sql`${table.quantity} > 0`),
    index("checkout_line_variant_id_idx").on(table.variantId),
  ],
);
