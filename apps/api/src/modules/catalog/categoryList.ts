import type { Executor } from "@commerce/db";
import { type SQL, sql } from "drizzle-orm";

// Saleor's `categories` and `Category.children` connections: filtered, sorted, keyset-paginated
// (saleor/graphql/core/connection.py). A cursor holds the row's sort value and id, base64-encoded
// JSON as Saleor's; a page is fetched with one extra row to know whether there is another page.
// Sorting: NAME and SUBCATEGORY_COUNT, always tie-broken by id so pages never overlap or skip rows.
// PRODUCT_COUNT comes with products (M2.2).

export type CategorySortField = "NAME" | "SUBCATEGORY_COUNT";
export type OrderDirection = "ASC" | "DESC";

export interface CategoryListArgs {
  search?: string | null;
  /** Depth in the tree: 0 = top level. */
  level?: number | null;
  parentId?: string | null;
  sort?: { field: CategorySortField; direction: OrderDirection } | null;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export type CategoryListRow = {
  id: string;
  name: string;
  slug: string;
  description: unknown;
  descriptionPlaintext: string;
  parentId: string | null;
  updatedAt: Date;
  level: number;
  subcategoryCount: number;
};

export interface CategoryPage {
  rows: { cursor: string; node: CategoryListRow }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

/** Cursor problems are the client's fault; the GraphQL layer reports them as Saleor does. */
export class InvalidCursorError extends Error {
  constructor() {
    super("Received cursor is invalid.");
    this.name = "InvalidCursorError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sortValue = (row: CategoryListRow, field: CategorySortField): string =>
  field === "NAME" ? row.name : String(row.subcategoryCount);

const encodeCursor = (row: CategoryListRow, field: CategorySortField): string =>
  Buffer.from(JSON.stringify([sortValue(row, field), row.id])).toString("base64");

function decodeCursor(cursor: string, field: CategorySortField): [string | number, string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== "string" ||
    typeof parsed[1] !== "string" ||
    !UUID.test(parsed[1])
  ) {
    throw new InvalidCursorError();
  }
  if (field === "SUBCATEGORY_COUNT") {
    const count = Number(parsed[0]);
    if (!Number.isInteger(count) || count < 0) throw new InvalidCursorError();
    return [count, parsed[1]];
  }
  return [parsed[0], parsed[1]];
}

export async function listCategories(db: Executor, args: CategoryListArgs): Promise<CategoryPage> {
  const field = args.sort?.field ?? "NAME";
  const direction = args.sort?.direction ?? "ASC";
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;

  const filters: SQL[] = [];
  if (args.search?.trim()) {
    const pattern = `%${args.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      sql`(c.name ILIKE ${pattern} OR c.slug ILIKE ${pattern} OR c.description_plaintext ILIKE ${pattern})`,
    );
  }
  if (args.level != null) filters.push(sql`t.level = ${args.level}`);
  if (args.parentId != null) filters.push(sql`c.parent_id = ${args.parentId}`);
  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

  const sortColumn = field === "NAME" ? sql`name` : sql`subcategory_count`;
  // Walking backwards reads the rows in reverse order, then flips them back.
  const ascending = (direction === "ASC") !== backwards;
  const order = ascending ? sql`ASC` : sql`DESC`;
  let keyset = sql``;
  if (cursor) {
    const [value, id] = decodeCursor(cursor, field);
    keyset = ascending
      ? sql`WHERE (${sortColumn}, id) > (${value}, ${id}::uuid)`
      : sql`WHERE (${sortColumn}, id) < (${value}, ${id}::uuid)`;
  }

  const base = sql`
    WITH RECURSIVE tree AS (
      SELECT id, 0 AS level FROM category WHERE parent_id IS NULL
      UNION ALL
      SELECT child.id, tree.level + 1 FROM category AS child JOIN tree ON child.parent_id = tree.id
    ),
    base AS (
      SELECT
        c.id, c.name, c.slug, c.description,
        c.description_plaintext AS "descriptionPlaintext",
        c.parent_id AS "parentId", c.updated_at AS "updatedAt",
        t.level,
        (SELECT count(*) FROM category AS s WHERE s.parent_id = c.id)::int AS subcategory_count
      FROM category AS c JOIN tree AS t ON t.id = c.id
      ${where}
    )`;

  const [pageRows, [{ count } = { count: 0 }]] = await Promise.all([
    db.execute<CategoryListRow & { subcategory_count: number }>(sql`
      ${base}
      SELECT * FROM base ${keyset}
      ORDER BY ${sortColumn} ${order}, id ${order}
      LIMIT ${limit + 1}`),
    db.execute<{ count: number }>(sql`${base} SELECT count(*)::int AS count FROM base`),
  ]);

  const rows = [...pageRows].map(({ subcategory_count, ...row }) => ({
    ...row,
    updatedAt: new Date(row.updatedAt),
    subcategoryCount: subcategory_count,
  }));
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (backwards) page.reverse();

  return {
    rows: page.map((node) => ({ cursor: encodeCursor(node, field), node })),
    // Like Saleor (and Relay's spec): the other direction is only known from the cursor's presence.
    hasNextPage: backwards ? Boolean(cursor) : hasMore,
    hasPreviousPage: backwards ? hasMore : Boolean(cursor),
    totalCount: count,
  };
}
