import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  pgEnum,
  pgTable,
  primaryKey,
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
    // Saleor's User.updated_at and last_login (M7.3): set by profile updates and by tokenCreate.
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLogin: timestamp("last_login", { withTimezone: true }),
  },
  (table) => [
    unique("user_email_unique").on(table.email),
    check("user_email_not_empty", sql`${table.email} <> ''`),
    // Every superuser has staff powers too (Django/Saleor semantics).
    check("user_superuser_is_staff", sql`NOT ${table.isSuperuser} OR ${table.isStaff}`),
  ],
);

// Login sessions (ADR-0006, ARCHITECTURE.md §7). The client holds a random token; only its SHA-256
// hash is stored, so a leaked table can't be replayed. Deleting the row revokes the session.
// ADR-0006's `kind` (staff|customer) is left out until customer login exists: today only staff
// log in, and `user.is_staff` already says which kind a session is.
export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    // Hex SHA-256 of the token.
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Hard cap on the session's total lifetime, set at creation.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Drives the sliding inactivity expiry.
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("session_token_hash_unique").on(table.tokenHash),
    index("session_user_id_idx").on(table.userId),
  ],
);

// Staff permissions: a closed set adapted from Saleor's `saleor/permission/enums.py`, limited to
// what we build (ARCHITECTURE.md §8). A code is added together with its feature; Postgres enum
// values can be added (a generated `ALTER TYPE ... ADD VALUE`) but not removed.
export const PERMISSIONS = [
  "MANAGE_PRODUCTS",
  "MANAGE_ORDERS",
  "MANAGE_CHECKOUTS",
  "MANAGE_USERS",
  "MANAGE_STAFF",
  "MANAGE_SETTINGS",
  "MANAGE_SHIPPING",
  // Saleor's payment.handle_payments: requesting transaction actions (refunds, M6.4).
  "HANDLE_PAYMENTS",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const permission = pgEnum("permission", PERMISSIONS);

// Saleor's `account.Group`. Only staff users may belong to one; that is checked where members
// are added (no cross-table CHECK in Postgres).
export const permissionGroup = pgTable(
  "permission_group",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
  },
  (table) => [
    unique("permission_group_name_unique").on(table.name),
    check("permission_group_name_not_empty", sql`${table.name} <> ''`),
  ],
);

export const permissionGroupPermission = pgTable(
  "permission_group_permission",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => permissionGroup.id, { onDelete: "cascade" }),
    code: permission("code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.code] })],
);

export const userPermissionGroup = pgTable(
  "user_permission_group",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => permissionGroup.id, { onDelete: "cascade" }),
  },
  (table) => [
    // (user_id, group_id) serves "a user's groups"; the index serves "a group's members".
    primaryKey({ columns: [table.userId, table.groupId] }),
    index("user_permission_group_group_id_idx").on(table.groupId),
  ],
);
