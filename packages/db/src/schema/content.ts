// Saleor's `page.Page` (saleor/page/models.py) and `menu.Menu` / `menu.MenuItem`
// (saleor/menu/models.py), owned by the API's `content` module. Pages are staff-written content
// the storefront shows at /pages/{slug}; menus are the storefront's navigation trees (`navbar`
// and `footer`), whose items point at a URL, category, collection or page. Page types and
// attributes are not modelled yet (ARCHITECTURE.md §4 deviations).
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
import { category, collection } from "./catalog.ts";

export const page = pgTable(
  "page",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    // EditorJS: { time?, blocks: [...], version? }, as category.description.
    content: jsonb("content"),
    contentPlaintext: text("content_plaintext").notNull().default(""),
    isPublished: boolean("is_published").notNull().default(false),
    // The moment the page was first published; null while it has never been published.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("page_slug_unique").on(table.slug),
    check("page_title_not_empty", sql`${table.title} <> ''`),
    check("page_slug_not_empty", sql`${table.slug} <> ''`),
  ],
);

// Saleor's `menu.Menu` (saleor/menu/models.py): the storefront's navigation menus. The migration
// seeds Saleor's two defaults, `navbar` and `footer`; staff add further menus.
export const menu = pgTable(
  "menu",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("menu_slug_unique").on(table.slug),
    check("menu_name_not_empty", sql`${table.name} <> ''`),
    check("menu_slug_not_empty", sql`${table.slug} <> ''`),
  ],
);

// Saleor's `menu.MenuItem`: a menu's navigation tree, with `parent_id` instead of MPTT and a dense
// `sort_order` per sibling group (0 = top level; level is computed, not stored). An item points at
// at most one target; deleting the target (or the menu) removes the item, as Saleor's CASCADE.
export const menuItem = pgTable(
  "menu_item",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menu.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => menuItem.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    url: text("url"),
    categoryId: uuid("category_id").references(() => category.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id").references(() => collection.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => page.id, { onDelete: "cascade" }),
  },
  (table) => [
    check("menu_item_name_not_empty", sql`${table.name} <> ''`),
    check("menu_item_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
    check(
      "menu_item_at_most_one_target",
      sql`((${table.url} IS NOT NULL)::int + (${table.categoryId} IS NOT NULL)::int + (${table.collectionId} IS NOT NULL)::int + (${table.pageId} IS NOT NULL)::int) <= 1`,
    ),
    index("menu_item_menu_parent_sort_idx").on(table.menuId, table.parentId, table.sortOrder),
  ],
);
