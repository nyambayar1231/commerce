// Saleor's `warehouse.Warehouse` and `warehouse.Stock` (ARCHITECTURE.md §3 "Inventory"). Owned by
// the API's `inventory` module. One warehouse row is inserted by its migration (ADR-0005, PLAN M3
// decision 2); `Stock` is keyed by (warehouse, variant) so multiple warehouses need no migration.
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { productVariant } from "./catalog.ts";

// Saleor's Warehouse without address (added in M5.2 when shipping needs it), channels, shipping
// zones, click-and-collect, `isPrivate` or metadata (PLAN M3 decisions 2–3).
export const warehouse = pgTable(
  "warehouse",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    email: text("email").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("warehouse_slug_unique").on(table.slug),
    check("warehouse_name_not_empty", sql`${table.name} <> ''`),
    check("warehouse_slug_not_empty", sql`${table.slug} <> ''`),
  ],
);

// Saleor's Stock. Its invariants are DB CHECKs (ARCHITECTURE.md §3): quantity ≥ 0,
// quantity_allocated ≥ 0 and quantity_allocated ≤ quantity. `allocation` arrives with order
// placement (M5.4, PLAN M3 decision 1), so quantity_allocated stays 0 until then.
export const stock = pgTable(
  "stock",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    quantityAllocated: integer("quantity_allocated").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("stock_warehouse_id_variant_id_unique").on(table.warehouseId, table.variantId),
    check("stock_quantity_not_negative", sql`${table.quantity} >= 0`),
    check("stock_quantity_allocated_not_negative", sql`${table.quantityAllocated} >= 0`),
    check(
      "stock_quantity_allocated_not_greater_than_quantity",
      sql`${table.quantityAllocated} <= ${table.quantity}`,
    ),
    index("stock_variant_id_idx").on(table.variantId),
  ],
);
