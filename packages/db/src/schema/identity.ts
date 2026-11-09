import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Staff and customers share one table, like Saleor's `account.User`
// (ARCHITECTURE.md §3 "Identity"). Owned by the API's `identity` module.

// citext: case-insensitive text, so emails compare equal regardless of case (e.g. in the unique
// constraint below). Requires the citext extension, created by migration 0002.
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    email: citext("email").notNull(),
    // Nullable: a staff user created by an admin may not have a password yet.
    passwordHash: text("password_hash"),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    isStaff: boolean("is_staff").notNull().default(false),
    isSuperuser: boolean("is_superuser").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("user_email_unique").on(table.email),
    check("user_email_not_empty", sql`${table.email} <> ''`),
    // Every superuser has staff powers too (Django/Saleor semantics).
    check("user_superuser_is_staff", sql`NOT ${table.isSuperuser} OR ${table.isStaff}`),
  ],
);
