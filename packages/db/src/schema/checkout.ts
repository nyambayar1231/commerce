// Saleor's `checkout.Checkout` and `checkout.CheckoutLine` (ARCHITECTURE.md §3 "Checkout"). Owned
// by the API's `checkout` module. A checkout holds no stored prices: totals are always computed
// from the current variant prices (§5.2).
import { sql } from "drizzle-orm";
import {
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

// The id is a random v4 UUID (PLAN M5 decision 4): it doubles as Saleor's checkout token, so it
// must be unguessable — unlike the time-ordered uuidv7() every other table uses. `user_id`,
// `shipping_method_id` and `completed_order_id` stay without foreign keys until the steps that
// introduce those tables (M5.2/M5.4 attach the constraints).
export const checkout = pgTable("checkout", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  email: text("email"),
  shippingAddress: jsonb("shipping_address"),
  billingAddress: jsonb("billing_address"),
  shippingMethodId: uuid("shipping_method_id"),
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
