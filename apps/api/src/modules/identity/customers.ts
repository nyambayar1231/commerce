import { type Executor, schema } from "@commerce/db";
import { and, eq, inArray, ne, type SQL, sql } from "drizzle-orm";
import { SESSION_USER_COLUMNS, type SessionUser } from "./sessions.ts";
import { NotFoundError } from "./staff.ts";
import { EMAIL_PATTERN } from "./users.ts";

// Staff management of customers (PLAN M7.3): Saleor's `customers` connection, `user(id)`, and
// customerCreate / customerUpdate / customerDelete / customerBulkDelete
// (../saleor-core/saleor/graphql/account/schema.py, mutations/staff/customer_*.py,
// bulk_mutations/customer_bulk_delete.py). Left out: notes, metadata, addresses, customer types,
// attributes, external references, `isConfirmed`, `redirectUrl` (the set-password email is M8,
// so created customers can't log in yet, as staffCreate users).
//
// Saleor's customers are non-staff users plus staff users who placed an order
// (`User.objects.customers()`). That rule reads the `order` table (read-only; the orders module
// owns it): the SQL is here because the orders module already depends on this one.

/** Saleor's customer set, over the `u` alias. */
const IS_CUSTOMER = sql`(u.is_staff = false OR EXISTS (SELECT 1 FROM "order" AS o WHERE o.user_id = u.id))`;

/** Saleor's UserSortField, without RANK (no full-text search). */
export type UserSortField =
  | "FIRST_NAME"
  | "LAST_NAME"
  | "EMAIL"
  | "ORDER_COUNT"
  | "CREATED_AT"
  | "LAST_MODIFIED_AT";

export interface CustomerListArgs {
  search?: string | null;
  sort?: { field?: UserSortField | null; direction: "ASC" | "DESC" } | null;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export interface CustomerPage {
  rows: { cursor: string; node: SessionUser }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

/** A cursor that doesn't belong to this list; the GraphQL layer reports it as Saleor does. */
export class InvalidCustomerCursorError extends Error {
  constructor() {
    super("Received cursor is invalid.");
    this.name = "InvalidCustomerCursorError";
  }
}

type KeyKind = "text" | "number";

/**
 * Saleor's sort keys per field (sorters.py: FIRST_NAME = first_name, last_name, pk; …), each as
 * an SQL expression over `u` and its kind. The id always comes last as the tie-breaker, so pages
 * never overlap or skip rows. Timestamps are epoch microseconds (a JS Date keeps milliseconds).
 */
function sortKeys(field: UserSortField): { expression: SQL; kind: KeyKind }[] {
  const micros = (column: SQL) => sql`(extract(epoch FROM ${column}) * 1000000)::bigint`;
  switch (field) {
    case "FIRST_NAME":
      return [
        { expression: sql`u.first_name`, kind: "text" },
        { expression: sql`u.last_name`, kind: "text" },
      ];
    case "LAST_NAME":
      return [
        { expression: sql`u.last_name`, kind: "text" },
        { expression: sql`u.first_name`, kind: "text" },
      ];
    case "EMAIL":
      return [{ expression: sql`u.email::text`, kind: "text" }];
    case "ORDER_COUNT":
      return [
        {
          expression: sql`(SELECT count(*) FROM "order" AS o WHERE o.user_id = u.id)::int`,
          kind: "number",
        },
        { expression: sql`u.email::text`, kind: "text" },
      ];
    case "CREATED_AT":
      return [{ expression: micros(sql`u.created_at`), kind: "number" }];
    case "LAST_MODIFIED_AT":
      return [{ expression: micros(sql`u.updated_at`), kind: "number" }];
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeCursor(cursor: string, kinds: readonly KeyKind[]): [(string | number)[], string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    throw new InvalidCustomerCursorError();
  }
  if (!Array.isArray(parsed) || parsed.length !== kinds.length + 1) {
    throw new InvalidCustomerCursorError();
  }
  const id = parsed.at(-1);
  if (typeof id !== "string" || !UUID.test(id)) throw new InvalidCustomerCursorError();
  const values = parsed.slice(0, -1) as unknown[];
  values.forEach((value, index) => {
    const ok =
      kinds[index] === "number"
        ? typeof value === "number" && Number.isSafeInteger(value)
        : typeof value === "string";
    if (!ok) throw new InvalidCustomerCursorError();
  });
  return [values as (string | number)[], id];
}

/** Saleor's `customers` list: searched, sorted, keyset-paginated. */
export async function listCustomers(db: Executor, args: CustomerListArgs): Promise<CustomerPage> {
  const field = args.sort?.field ?? "EMAIL";
  const direction = args.sort?.direction ?? "ASC";
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;
  const keys = sortKeys(field);

  const filters: SQL[] = [IS_CUSTOMER];
  const search = args.search?.trim();
  if (search) {
    // Saleor searches a vector of email, names and addresses; we match email and names.
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      sql`(u.email ILIKE ${pattern} OR u.first_name ILIKE ${pattern} OR u.last_name ILIKE ${pattern} OR (u.first_name || ' ' || u.last_name) ILIKE ${pattern})`,
    );
  }
  const keyColumns = keys.map((key, index) => sql`${key.expression} AS k${sql.raw(String(index))}`);
  const base = sql`WITH base AS (
    SELECT u.id, ${sql.join(keyColumns, sql`, `)} FROM "user" AS u WHERE ${sql.join(filters, sql` AND `)}
  )`;
  const keyNames = keys.map((_key, index) => sql.raw(`k${index}`));

  // Walking backwards reads the rows in reverse order, then flips them back.
  const ascending = (direction === "ASC") !== backwards;
  const order = ascending ? sql`ASC` : sql`DESC`;
  let keyset = sql``;
  if (cursor) {
    const [values, id] = decodeCursor(
      cursor,
      keys.map((key) => key.kind),
    );
    const left = sql`(${sql.join(keyNames, sql`, `)}, id)`;
    const right = sql`(${sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )}, ${id}::uuid)`;
    keyset = ascending ? sql`WHERE ${left} > ${right}` : sql`WHERE ${left} < ${right}`;
  }
  const orderBy = sql.join(
    [...keyNames, sql.raw("id")].map((name) => sql`${name} ${order}`),
    sql`, `,
  );

  const [pageRows, [{ count } = { count: 0 }]] = await Promise.all([
    db.execute<Record<string, string | number>>(sql`
      ${base}
      SELECT * FROM base ${keyset}
      ORDER BY ${orderBy}
      LIMIT ${limit + 1}`),
    db.execute<{ count: number }>(sql`${base} SELECT count(*)::int AS count FROM base`),
  ]);

  const page = [...pageRows].slice(0, limit);
  const hasMore = pageRows.length > limit;
  if (backwards) page.reverse();
  const users =
    page.length === 0
      ? []
      : await db
          .select(SESSION_USER_COLUMNS)
          .from(schema.user)
          .where(
            inArray(
              schema.user.id,
              page.map((row) => String(row.id)),
            ),
          );
  const byId = new Map(users.map((user) => [user.id, user]));
  const rows = page.flatMap((row) => {
    const node = byId.get(String(row.id));
    if (!node) return [];
    const values = keys.map((key, index) =>
      key.kind === "number" ? Number(row[`k${index}`]) : String(row[`k${index}`]),
    );
    return [
      {
        cursor: Buffer.from(JSON.stringify([...values, node.id])).toString("base64"),
        node,
      },
    ];
  });

  return {
    rows,
    hasNextPage: backwards ? Boolean(args.before) : hasMore,
    hasPreviousPage: backwards ? hasMore : Boolean(args.after),
    totalCount: count,
  };
}

/**
 * Saleor's `user(id)` rules (graphql/account/resolvers.py resolve_user): MANAGE_STAFF and
 * MANAGE_USERS together see anyone; MANAGE_STAFF alone sees staff; MANAGE_USERS or MANAGE_ORDERS
 * see customers. Anything else is null.
 */
export async function getUserForStaff(
  db: Executor,
  id: string,
  permissions: readonly string[],
): Promise<SessionUser | null> {
  const staff = permissions.includes("MANAGE_STAFF");
  const customers = permissions.includes("MANAGE_USERS") || permissions.includes("MANAGE_ORDERS");
  if (!staff && !customers) return null;
  const scope =
    staff && permissions.includes("MANAGE_USERS")
      ? sql`TRUE`
      : staff
        ? sql`u.is_staff`
        : IS_CUSTOMER;
  const rows = await db.execute<{ id: string }>(
    sql`SELECT u.id FROM "user" AS u WHERE u.id = ${id}::uuid AND ${scope}`,
  );
  if (rows.length === 0) return null;
  const [user] = await db
    .select(SESSION_USER_COLUMNS)
    .from(schema.user)
    .where(eq(schema.user.id, id));
  return user ?? null;
}

// --- Mutations

export type CustomerErrorCode =
  | "DELETE_OWN_ACCOUNT"
  | "DELETE_STAFF_ACCOUNT"
  | "DELETE_SUPERUSER_ACCOUNT"
  | "INVALID"
  | "REQUIRED"
  | "UNIQUE";

export type CustomerError = { field: string | null; code: CustomerErrorCode; message: string };

export type CustomerInput = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean | null;
};

export type CustomerResult = { ok: true; id: string } | { ok: false; errors: CustomerError[] };

// Saleor's (Django's) messages.
const MESSAGES = {
  required: "This field is required.",
  invalidEmail: "Enter a valid email address.",
  emailTaken: "User with this Email already exists.",
  staffAccount: "Cannot edit a staff account.",
  deleteOwn: "You cannot delete your own account.",
  deleteSuperuser: "Cannot delete this account.",
  deleteStaff: "Cannot delete a staff account.",
} as const;

/** The cleaned email (trimmed, lower-cased as Saleor) or its error; `exceptId` may keep its own. */
async function cleanEmail(
  db: Executor,
  value: string,
  exceptId: string | null,
): Promise<{ email: string } | { error: CustomerError }> {
  const email = value.trim().toLowerCase();
  if (email === "")
    return { error: { field: "email", code: "REQUIRED", message: MESSAGES.required } };
  if (!EMAIL_PATTERN.test(email)) {
    return { error: { field: "email", code: "INVALID", message: MESSAGES.invalidEmail } };
  }
  const taken = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(
      exceptId === null
        ? eq(schema.user.email, email)
        : and(eq(schema.user.email, email), ne(schema.user.id, exceptId)),
    );
  if (taken.length > 0) {
    return { error: { field: "email", code: "UNIQUE", message: MESSAGES.emailTaken } };
  }
  return { email };
}

/** True when the insert or update hit `user_email_unique` (a concurrent create won the email). */
const isEmailConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "cause" in error &&
  typeof error.cause === "object" &&
  error.cause !== null &&
  "constraint_name" in error.cause &&
  error.cause.constraint_name === "user_email_unique";

const emailTaken: { ok: false; errors: CustomerError[] } = {
  ok: false,
  errors: [{ field: "email", code: "UNIQUE", message: MESSAGES.emailTaken }],
};

/** Saleor's customerCreate: a non-staff user without a password (MANAGE_USERS). */
export async function createCustomer(db: Executor, input: CustomerInput): Promise<CustomerResult> {
  const cleaned = await cleanEmail(db, input.email ?? "", null);
  if ("error" in cleaned) return { ok: false, errors: [cleaned.error] };
  try {
    const [created] = await db
      .insert(schema.user)
      .values({
        email: cleaned.email,
        firstName: input.firstName?.trim() ?? "",
        lastName: input.lastName?.trim() ?? "",
        isActive: input.isActive ?? true,
        // Saleor: a customer created by staff is unconfirmed until they set a password (later).
        isConfirmed: false,
        isStaff: false,
      })
      .returning({ id: schema.user.id });
    if (!created) throw new Error("user insert returned no row");
    return { ok: true, id: created.id };
  } catch (error) {
    // Saleor's _save: a concurrent create of the same email is the same UNIQUE error.
    if (isEmailConflict(error)) return emailTaken;
    throw error;
  }
}

/**
 * Saleor's customerUpdate: only the given fields change. Unlike Saleor, a staff account is
 * refused (a MANAGE_USERS holder could otherwise deactivate a superuser or change their email).
 * `emailChanged` tells the caller to link the new email's guest orders (Saleor does it here).
 * Throws NotFoundError for an unknown id.
 */
export async function updateCustomer(
  db: Executor,
  id: string,
  input: CustomerInput,
): Promise<
  | { ok: true; id: string; email: string; emailChanged: boolean }
  | { ok: false; errors: CustomerError[] }
> {
  const [current] = await db
    .select({ email: schema.user.email, isStaff: schema.user.isStaff })
    .from(schema.user)
    .where(eq(schema.user.id, id));
  if (!current) throw new NotFoundError("User", [id]);
  if (current.isStaff) {
    return {
      ok: false,
      errors: [{ field: "id", code: "INVALID", message: MESSAGES.staffAccount }],
    };
  }

  const changes: Partial<typeof schema.user.$inferInsert> = {};
  if (input.email != null) {
    const cleaned = await cleanEmail(db, input.email, id);
    if ("error" in cleaned) return { ok: false, errors: [cleaned.error] };
    changes.email = cleaned.email;
  }
  if (input.firstName != null) changes.firstName = input.firstName.trim();
  if (input.lastName != null) changes.lastName = input.lastName.trim();
  if (input.isActive != null) changes.isActive = input.isActive;

  const email = changes.email ?? current.email;
  if (Object.keys(changes).length === 0) return { ok: true, id, email, emailChanged: false };
  try {
    await db
      .update(schema.user)
      .set({ ...changes, updatedAt: sql`now()` })
      .where(eq(schema.user.id, id));
  } catch (error) {
    if (isEmailConflict(error)) return emailTaken;
    throw error;
  }
  return { ok: true, id, email, emailChanged: email !== current.email };
}

/**
 * Saleor's customerDelete / customerBulkDelete (CustomerDeleteMixin): your own account, superusers
 * and staff are refused per id; the rest are deleted. Their sessions go with them (cascade); their
 * orders, checkouts and history entries stay with the user cleared (PLAN M7 decision 8).
 * Throws NotFoundError when an id doesn't exist.
 */
export async function deleteCustomers(
  db: Executor,
  requesterId: string,
  ids: readonly string[],
): Promise<{ deleted: SessionUser[]; errors: (CustomerError & { userId: string })[] }> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { deleted: [], errors: [] };
  const users = await db
    .select(SESSION_USER_COLUMNS)
    .from(schema.user)
    .where(inArray(schema.user.id, unique));
  const missing = unique.filter((id) => !users.some((user) => user.id === id));
  if (missing.length > 0) throw new NotFoundError("User", missing);

  const errors: (CustomerError & { userId: string })[] = [];
  const deletable: SessionUser[] = [];
  for (const user of users) {
    const refusal: [CustomerErrorCode, string] | null =
      user.id === requesterId
        ? ["DELETE_OWN_ACCOUNT", MESSAGES.deleteOwn]
        : user.isSuperuser
          ? ["DELETE_SUPERUSER_ACCOUNT", MESSAGES.deleteSuperuser]
          : user.isStaff
            ? ["DELETE_STAFF_ACCOUNT", MESSAGES.deleteStaff]
            : null;
    if (refusal)
      errors.push({ field: "id", code: refusal[0], message: refusal[1], userId: user.id });
    else deletable.push(user);
  }
  if (deletable.length === 0) return { deleted: [], errors };
  const removed = await db
    .delete(schema.user)
    .where(
      and(
        inArray(
          schema.user.id,
          deletable.map((user) => user.id),
        ),
        // Re-checked in the statement, so a user promoted to staff meanwhile is not deleted.
        eq(schema.user.isStaff, false),
      ),
    )
    .returning({ id: schema.user.id });
  const removedIds = new Set(removed.map((row) => row.id));
  return { deleted: deletable.filter((user) => removedIds.has(user.id)), errors };
}
