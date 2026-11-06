import { sql } from "drizzle-orm";
import { char, check, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

// Single-row shop configuration (ARCHITECTURE.md §3 "Shop"). Owned by the API's `shop` module.
export const shopSettings = pgTable(
  "shop_settings",
  {
    id: smallint("id").primaryKey().default(1),
    name: text("name").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    defaultCountry: char("default_country", { length: 2 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The only allowed id is 1, so a second row is impossible.
    check("shop_settings_single_row", sql`${table.id} = 1`),
    check("shop_settings_name_not_empty", sql`${table.name} <> ''`),
    check("shop_settings_currency_iso", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("shop_settings_country_iso", sql`${table.defaultCountry} ~ '^[A-Z]{2}$'`),
  ],
);
