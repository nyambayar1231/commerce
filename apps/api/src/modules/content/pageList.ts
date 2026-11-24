import type { Executor } from "@commerce/db";
import { type SQL, sql } from "drizzle-orm";
import { InvalidCursorError, type OrderDirection } from "../catalog/index.ts";
import type { PageRow } from "./pages.ts";

// Saleor's `pages` connection (saleor/graphql/page/schema.py, saleor/graphql/page/sorters.py):
// filtered, sorted, keyset-paginated. The cursor format, the InvalidCursorError and the page-info
// rules are the same as `collections` (catalog/collections.ts). Sorting always tie-breaks by id,
// so pages never overlap or skip rows.

export type PageSortField = "TITLE" | "SLUG" | "VISIBILITY" | "CREATION_DATE" | "PUBLICATION_DATE";

export interface PageListArgs {
  search?: string | null;
  /** Page primary keys; an explicitly empty list matches nothing. */
  ids?: readonly string[] | null;
  /** Staff with MANAGE_PAGES see unpublished and future-dated pages too. */
  includeUnpublished?: boolean;
  sort?: { field: PageSortField; direction: OrderDirection } | null;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export type PageListRow = PageRow;

export interface PagePage {
  rows: { cursor: string; node: PageListRow }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A row with its timestamps as epoch microseconds (digit strings), the date sorts' cursor values. */
type KeyedRow = { node: PageListRow; createdAtMicros: string; publishedAtMicros: string | null };

// A never-published page sorts as the largest date, which is how Postgres orders NULL in
// `published_at` (Saleor's field): last ascending, first descending. The SQL sort below uses the
// same value so a cursor keeps pointing at the right row.
const NO_PUBLICATION_DATE_MICROS = "9223372036854775807";

const sortValue = (row: KeyedRow, field: PageSortField): string => {
  switch (field) {
    case "TITLE":
      return row.node.title;
    case "SLUG":
      return row.node.slug;
    case "VISIBILITY":
      return row.node.isPublished ? "1" : "0";
    case "CREATION_DATE":
      return row.createdAtMicros;
    case "PUBLICATION_DATE":
      return row.publishedAtMicros ?? NO_PUBLICATION_DATE_MICROS;
  }
};

const encodeCursor = (row: KeyedRow, field: PageSortField): string =>
  Buffer.from(JSON.stringify([sortValue(row, field), row.node.id])).toString("base64");

function decodeCursor(cursor: string, field: PageSortField): [string | number, string] {
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
  if (field === "VISIBILITY") {
    if (parsed[0] !== "0" && parsed[0] !== "1") throw new InvalidCursorError();
    return [Number(parsed[0]), parsed[1]];
  }
  if (field === "CREATION_DATE" || field === "PUBLICATION_DATE") {
    // Epoch microseconds; kept as a string, the SQL compares them as bigint.
    if (!/^\d{1,19}$/.test(parsed[0])) throw new InvalidCursorError();
  }
  return [parsed[0], parsed[1]];
}

/** Rows as the raw query returns them: `bigint` arrives as a string, timestamps as Date. */
type RawPageRow = PageRow & {
  createdAtMicros: string;
  publishedAtMicros: string | null;
};

export async function listPages(db: Executor, args: PageListArgs): Promise<PagePage> {
  const field = args.sort?.field ?? "TITLE";
  const direction = args.sort?.direction ?? "ASC";
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;

  const filters: SQL[] = [];
  // Saleor's page visibility, as collections: published and not scheduled for later. Staff with
  // MANAGE_PAGES skip it.
  if (!args.includeUnpublished) {
    filters.push(sql`p.is_published AND (p.published_at IS NULL OR p.published_at <= now())`);
  }
  if (args.search?.trim()) {
    const pattern = `%${args.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(sql`(p.title ILIKE ${pattern} OR p.slug ILIKE ${pattern})`);
  }
  // Saleor's PageFilterInput.ids: exact primary keys. An explicit empty list matches nothing,
  // while an absent `ids` is no condition at all.
  if (args.ids != null) {
    filters.push(
      args.ids.length === 0
        ? sql`FALSE`
        : sql`p.id IN (${sql.join(
            args.ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
    );
  }
  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

  const sortColumn: SQL = {
    TITLE: sql`title`,
    SLUG: sql`slug`,
    VISIBILITY: sql`"isPublished"::int`,
    CREATION_DATE: sql`"createdAtMicros"`,
    // As `sortValue`: a missing publication date is the largest one.
    PUBLICATION_DATE: sql`COALESCE("publishedAtMicros", ${NO_PUBLICATION_DATE_MICROS}::bigint)`,
  }[field];
  // Walking backwards reads the rows in reverse order, then flips them back.
  const ascending = (direction === "ASC") !== backwards;
  const order = ascending ? sql`ASC` : sql`DESC`;
  let keyset = sql``;
  if (cursor) {
    const [decoded, id] = decodeCursor(cursor, field);
    const value =
      field === "CREATION_DATE" || field === "PUBLICATION_DATE"
        ? sql`${decoded}::bigint`
        : sql`${decoded}`;
    keyset = ascending
      ? sql`WHERE (${sortColumn}, id) > (${value}, ${id}::uuid)`
      : sql`WHERE (${sortColumn}, id) < (${value}, ${id}::uuid)`;
  }

  const base = sql`
    WITH base AS (
      SELECT
        p.id, p.title, p.slug, p.content,
        p.content_plaintext AS "contentPlaintext",
        p.is_published AS "isPublished", p.published_at AS "publishedAt",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt",
        (extract(epoch FROM p.created_at) * 1000000)::bigint AS "createdAtMicros",
        (extract(epoch FROM p.published_at) * 1000000)::bigint AS "publishedAtMicros"
      FROM page AS p
      ${where}
    )`;

  const [pageRows, [{ count } = { count: 0 }]] = await Promise.all([
    db.execute<RawPageRow>(sql`
      ${base}
      SELECT * FROM base ${keyset}
      ORDER BY ${sortColumn} ${order}, id ${order}
      LIMIT ${limit + 1}`),
    db.execute<{ count: number }>(sql`${base} SELECT count(*)::int AS count FROM base`),
  ]);

  const rows = [...pageRows].map(
    (row): KeyedRow => ({
      createdAtMicros: String(row.createdAtMicros),
      publishedAtMicros: row.publishedAtMicros === null ? null : String(row.publishedAtMicros),
      node: {
        id: row.id,
        title: row.title,
        slug: row.slug,
        content: row.content,
        contentPlaintext: row.contentPlaintext,
        isPublished: row.isPublished,
        publishedAt: row.publishedAt === null ? null : new Date(row.publishedAt),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      },
    }),
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (backwards) page.reverse();

  return {
    rows: page.map((node) => ({ cursor: encodeCursor(node, field), node: node.node })),
    // Like Saleor (and Relay's spec): the other direction is only known from the cursor's presence.
    hasNextPage: backwards ? Boolean(cursor) : hasMore,
    hasPreviousPage: backwards ? hasMore : Boolean(cursor),
    totalCount: count,
  };
}
