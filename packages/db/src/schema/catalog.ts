// Saleor's `product.Category` (ARCHITECTURE.md §3 "Catalog"). Owned by the API's `catalog` module.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
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
