// Saleor's `page.Page` (saleor/page/models.py), owned by the API's `content` module. Pages are
// staff-written content the storefront shows at /pages/{slug}. Page types and attributes are not
// modelled yet (ARCHITECTURE.md §4 deviations); menus (Saleor's `menu.Menu`) join this module in
// M15.6b.
import { sql } from "drizzle-orm";
import { boolean, check, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
