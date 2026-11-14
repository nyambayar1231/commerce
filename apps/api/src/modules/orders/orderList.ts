import type { Executor } from "@commerce/db";
import { schema } from "@commerce/db";
import { inArray, type SQL, sql } from "drizzle-orm";
import { orderNetChargedSql } from "../payments/index.ts";
import type { OrderRow } from "./orders.ts";

// Saleor's `orders` connection for staff (saleor/graphql/order/schema.py, sorters.py): filtered by
// status, searched by number or email, sorted, keyset-paginated. The cursor is
// base64(JSON([sortValue, id])) as in the product list; sorting always tie-breaks by id, so pages
// never overlap or skip rows. The page query reads only ids and sort keys; the rows are then loaded
// by id.

/** Saleor's OrderSortField; CREATION_DATE and RANK are aliases of CREATED_AT and NUMBER. */
export type OrderSortField =
  | "NUMBER"
  | "RANK"
  | "CREATION_DATE"
  | "CREATED_AT"
  | "LAST_MODIFIED_AT"
  | "CUSTOMER"
  | "PAYMENT"
  | "FULFILLMENT_STATUS";

export type OrderStatus = (typeof schema.ORDER_STATUSES)[number];

export interface OrderWhere {
  ids?: readonly string[] | null;
  /** The orders of one user (`User.orders`); not part of the GraphQL `where` input. */
  userId?: string | null;
  /** List drafts (`draftOrders`) instead of placed orders (Saleor's drafts()/non_draft()). */
  drafts?: boolean;
  status?: { eq?: OrderStatus | null; oneOf?: readonly OrderStatus[] | null } | null;
}

export interface OrderListArgs {
  search?: string | null;
  where?: OrderWhere | null;
  sort?: { field?: OrderSortField | null; direction: "ASC" | "DESC" } | null;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export interface OrderPage {
  rows: { cursor: string; node: OrderRow }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

/** A cursor that doesn't belong to this list; the GraphQL layer reports it as Saleor does. */
export class InvalidOrderCursorError extends Error {
  constructor() {
    super("Received cursor is invalid.");
    this.name = "InvalidOrderCursorError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SortKind = "number" | "text";

/** The SQL sort expression over the `o` alias, and how its cursor value is checked. */
function sortSpec(field: OrderSortField): { expression: SQL; kind: SortKind } {
  switch (field) {
    case "NUMBER":
    case "RANK":
      return { expression: sql`o.number`, kind: "number" };
    // Timestamps sort as epoch microseconds: a JS Date (and an ISO cursor) keeps only
    // milliseconds, which would put the cursor's own row on the next page again.
    case "CREATED_AT":
    case "CREATION_DATE":
      return {
        expression: sql`(extract(epoch FROM o.created_at) * 1000000)::bigint`,
        kind: "number",
      };
    case "LAST_MODIFIED_AT":
      return {
        expression: sql`(extract(epoch FROM o.updated_at) * 1000000)::bigint`,
        kind: "number",
      };
    case "CUSTOMER":
      return { expression: sql`o.user_email`, kind: "text" };
    case "FULFILLMENT_STATUS":
      return { expression: sql`o.status`, kind: "text" };
    case "PAYMENT":
      // Saleor's charge status as a rank: NONE 0, PARTIAL 1, FULL 2, OVERCHARGED 3.
      return {
        expression: sql`(CASE
          WHEN ${orderNetChargedSql(sql`o.id`)} <= 0 AND o.total_amount > 0 THEN 0
          WHEN ${orderNetChargedSql(sql`o.id`)} < o.total_amount THEN 1
          WHEN ${orderNetChargedSql(sql`o.id`)} = o.total_amount THEN 2
          ELSE 3 END)`,
        kind: "number",
      };
  }
}

function decodeCursor(cursor: string, kind: SortKind): [string | number, string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    throw new InvalidOrderCursorError();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[1] !== "string" ||
    !UUID.test(parsed[1])
  ) {
    throw new InvalidOrderCursorError();
  }
  const [value, id] = parsed as [unknown, string];
  if (kind === "number") {
    if (typeof value !== "number" || !Number.isSafeInteger(value))
      throw new InvalidOrderCursorError();
    return [value, id];
  }
  if (typeof value !== "string") throw new InvalidOrderCursorError();
  return [value, id];
}

const encodeCursor = (value: unknown, id: string): string =>
  Buffer.from(JSON.stringify([value, id])).toString("base64");

function whereToSql(args: OrderListArgs): SQL {
  const where = args.where;
  const filters: SQL[] = [where?.drafts ? sql`o.status = 'DRAFT'` : sql`o.status <> 'DRAFT'`];
  if (where?.ids != null) {
    filters.push(
      where.ids.length === 0
        ? sql`FALSE`
        : sql`o.id IN (${sql.join(
            where.ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
    );
  }
  if (where?.userId != null) filters.push(sql`o.user_id = ${where.userId}::uuid`);
  if (where?.status != null) {
    const values = where.status.eq != null ? [where.status.eq] : (where.status.oneOf ?? []);
    filters.push(
      values.length === 0
        ? sql`FALSE`
        : sql`o.status IN (${sql.join(
            values.map((value) => sql`${value}`),
            sql`, `,
          )})`,
    );
  }
  const search = args.search?.trim();
  if (search) {
    // Saleor searches number, email and more; we search the order number and the customer email.
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const byNumber = /^\d{1,15}$/.test(search) ? sql` OR o.number = ${Number(search)}` : sql``;
    filters.push(sql`(o.user_email ILIKE ${pattern}${byNumber})`);
  }
  return sql`WHERE ${sql.join(filters, sql` AND `)}`;
}

export async function listOrders(db: Executor, args: OrderListArgs): Promise<OrderPage> {
  const field = args.sort?.field ?? "NUMBER";
  const direction = args.sort?.direction ?? "DESC";
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;
  const { expression, kind } = sortSpec(field);
  const where = whereToSql(args);

  // Walking backwards reads the rows in reverse order, then flips them back.
  const ascending = (direction === "ASC") !== backwards;
  const order = ascending ? sql`ASC` : sql`DESC`;
  let keyset = sql``;
  if (cursor) {
    const [value, id] = decodeCursor(cursor, kind);
    keyset = ascending
      ? sql`WHERE (sort_value, id) > (${value}, ${id}::uuid)`
      : sql`WHERE (sort_value, id) < (${value}, ${id}::uuid)`;
  }
  const base = sql`WITH base AS (SELECT o.id, ${expression} AS sort_value FROM "order" AS o ${where})`;

  const [pageRows, [{ count } = { count: 0 }]] = await Promise.all([
    db.execute<{ id: string; sort_value: string | number }>(sql`
      ${base}
      SELECT id, sort_value FROM base ${keyset}
      ORDER BY sort_value ${order}, id ${order}
      LIMIT ${limit + 1}`),
    db.execute<{ count: number }>(sql`${base} SELECT count(*)::int AS count FROM base`),
  ]);

  const keys = [...pageRows];
  const hasMore = keys.length > limit;
  const page = keys.slice(0, limit);
  if (backwards) page.reverse();

  const rows =
    page.length === 0
      ? []
      : await db
          .select()
          .from(schema.order)
          .where(
            inArray(
              schema.order.id,
              page.map((key) => key.id),
            ),
          );
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    rows: page.map((key) => {
      const node = byId.get(key.id);
      if (!node) throw new Error(`order ${key.id} disappeared while listing`);
      const value = kind === "number" ? Number(key.sort_value) : String(key.sort_value);
      return { cursor: encodeCursor(value, key.id), node };
    }),
    hasNextPage: backwards ? Boolean(cursor) : hasMore,
    hasPreviousPage: backwards ? hasMore : Boolean(cursor),
    totalCount: count,
  };
}
