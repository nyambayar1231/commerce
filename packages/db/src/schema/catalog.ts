// Saleor's `product.Category` (ARCHITECTURE.md §3 "Catalog"). Owned by the API's `catalog` module.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
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

// Owned by the API's `catalog` module. Saleor's `product.Category`, with a parent_id tree
// instead of MPTT (ARCHITECTURE.md §3 "Catalog").
export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // EditorJS: { time?, blocks: [...], version? }. HTML sanitising is handled separately.
    description: jsonb("description"),
    descriptionPlaintext: text("description_plaintext").notNull().default(""),
    parentId: uuid("parent_id").references((): AnyPgColumn => category.id, {
      onDelete: "cascade",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("category_slug_unique").on(table.slug),
    check("category_name_not_empty", sql`${table.name} <> ''`),
    check("category_slug_not_empty", sql`${table.slug} <> ''`),
    index("category_parent_id_idx").on(table.parentId),
  ],
);

// Saleor's `product.Product`, single channel (ADR-0005): publication lives on the product instead
// of a channel listing. No product types or attributes yet (ARCHITECTURE §3). A product outlives
// its category (`SET NULL`, as Saleor). "At least one variant before publishing" is checked by the
// product service (M2.4).
export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    categoryId: uuid("category_id").references(() => category.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // EditorJS: { time?, blocks: [...], version? }, as category.description.
    description: jsonb("description"),
    descriptionPlaintext: text("description_plaintext").notNull().default(""),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("product_slug_unique").on(table.slug),
    check("product_name_not_empty", sql`${table.name} <> ''`),
    check("product_slug_not_empty", sql`${table.slug} <> ''`),
    index("product_category_id_idx").on(table.categoryId),
    // `products(where: {updatedAt: ...})` and the LAST_MODIFIED_AT sort.
    index("product_updated_at_idx").on(table.updatedAt),
  ],
);

// Saleor's `product.ProductVariant` with its single-channel price inline (Saleor keeps the price
// in ProductVariantChannelListing). Money is an integer count of minor units plus the currency on
// every row (ADR-0013); the service checks the currency is the shop's.
export const productVariant = pgTable(
  "product_variant",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    // Optional, unique when set (Postgres allows several NULLs).
    sku: text("sku"),
    name: text("name").notNull().default(""),
    priceAmount: bigint("price_amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    trackInventory: boolean("track_inventory").notNull().default(true),
    weightGrams: integer("weight_grams"),
    // Order within the product (Saleor's sort_order).
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("product_variant_sku_unique").on(table.sku),
    check("product_variant_sku_not_empty", sql`${table.sku} IS NULL OR ${table.sku} <> ''`),
    check("product_variant_price_not_negative", sql`${table.priceAmount} >= 0`),
    check("product_variant_currency_not_empty", sql`${table.currency} <> ''`),
    check(
      "product_variant_weight_not_negative",
      sql`${table.weightGrams} IS NULL OR ${table.weightGrams} >= 0`,
    ),
    index("product_variant_product_id_idx").on(table.productId),
    // `price` / `minimalPrice` filters: min(price_amount) per product and the EXISTS check.
    index("product_variant_product_id_price_amount_idx").on(table.productId, table.priceAmount),
  ],
);
