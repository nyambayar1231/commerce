import type { Money } from "@commerce/contracts";
import type { Executor } from "@commerce/db";
import { type SQL, sql } from "drizzle-orm";
import { InvalidCursorError, type OrderDirection } from "./categoryList.ts";
import { type ProductRow, toMoney } from "./products.ts";

// Saleor's `products` connection (saleor/graphql/core/connection.py): filtered, sorted,
// keyset-paginated. The cursor format, the InvalidCursorError and the page-info rules are the
// same as `categories` (categoryList.ts). Sorting always tie-breaks by id, so pages never overlap
// or skip rows.

export type ProductSortField = "NAME" | "PRICE" | "PUBLISHED" | "CREATED_AT" | "LAST_MODIFIED_AT";

export interface ProductListArgs {
  search?: string | null;
  /** Restrict to this category and all its descendants, as Saleor does for `Category.products`. */
  categoryId?: string | null;
  sort?: { field?: ProductSortField | null; direction: OrderDirection } | null;
  /** Staff with MANAGE_PRODUCTS see unpublished and future-dated products too. */
  includeUnpublished?: boolean;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export type ProductListRow = ProductRow & { minimalPrice: Money | null };

export interface ProductPage {
  rows: { cursor: string; node: ProductListRow }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sortValue = (row: ProductListRow, field: ProductSortField): string => {
  switch (field) {
    case "NAME":
      return row.name;
    case "PRICE":
      // COALESCE(min variant price, -1): products without variants come first ascending.
      return String(row.minimalPrice?.amountMinor ?? -1);
    case "PUBLISHED":
      return row.isPublished ? "1" : "0";
    case "CREATED_AT":
      return row.createdAt.toISOString();
    case "LAST_MODIFIED_AT":
      return row.updatedAt.toISOString();
  }
};

const encodeCursor = (row: ProductListRow, field: ProductSortField): string =>
  Buffer.from(JSON.stringify([sortValue(row, field), row.id])).toString("base64");

function decodeCursor(cursor: string, field: ProductSortField): [string | number, string] {
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
  if (field === "PRICE") {
    const amount = Number(parsed[0]);
    if (!Number.isInteger(amount) || amount < -1) throw new InvalidCursorError();
    return [amount, parsed[1]];
  }
  if (field === "PUBLISHED") {
    if (parsed[0] !== "0" && parsed[0] !== "1") throw new InvalidCursorError();
    return [Number(parsed[0]), parsed[1]];
  }
  if (field === "CREATED_AT" || field === "LAST_MODIFIED_AT") {
    if (Number.isNaN(Date.parse(parsed[0]))) throw new InvalidCursorError();
  }
  return [parsed[0], parsed[1]];
}

/** Rows as the raw query returns them: `bigint` arrives as a string, timestamps as Date. */
type RawProductRow = {
  id: string;
  name: string;
  slug: string;
  description: unknown;
  descriptionPlaintext: string;
  categoryId: string | null;
  isPublished: boolean;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  minPriceAmount: string | number | null;
  minPriceCurrency: string | null;
};

export async function listProducts(db: Executor, args: ProductListArgs): Promise<ProductPage> {
  const field = args.sort?.field ?? "NAME";
  const direction = args.sort?.direction ?? "ASC";
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;

  const filters: SQL[] = [];
  if (!args.includeUnpublished) {
    filters.push(sql`p.is_published AND (p.published_at IS NULL OR p.published_at <= now())`);
  }
  if (args.categoryId != null) {
    filters.push(sql`p.category_id IN (SELECT id FROM subtree)`);
  }
  if (args.search?.trim()) {
    const pattern = `%${args.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      sql`(p.name ILIKE ${pattern} OR p.slug ILIKE ${pattern} OR p.description_plaintext ILIKE ${pattern} OR EXISTS (SELECT 1 FROM product_variant AS v WHERE v.product_id = p.id AND v.sku ILIKE ${pattern}))`,
    );
  }
  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

  const sortColumn: SQL = {
    NAME: sql`name`,
    PRICE: sql`COALESCE("minPriceAmount", -1)`,
    PUBLISHED: sql`"isPublished"::int`,
    CREATED_AT: sql`"createdAt"`,
    LAST_MODIFIED_AT: sql`"updatedAt"`,
  }[field];
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

  const select = sql`
      SELECT
        p.id, p.name, p.slug, p.description,
        p.description_plaintext AS "descriptionPlaintext",
        p.category_id AS "categoryId", p.is_published AS "isPublished",
        p.published_at AS "publishedAt", p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        (SELECT min(v.price_amount) FROM product_variant AS v WHERE v.product_id = p.id)
          AS "minPriceAmount",
        (SELECT v.currency FROM product_variant AS v WHERE v.product_id = p.id
          ORDER BY v.price_amount, v.id LIMIT 1) AS "minPriceCurrency"
      FROM product AS p
      ${where}`;
  // A category lists its own products and those of every descendant, as Saleor's
  // `root.get_descendants(include_self=True)`; the recursive CTE walks `category.parent_id`.
  const base =
    args.categoryId != null
      ? sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM category WHERE id = ${args.categoryId}
      UNION ALL
      SELECT child.id FROM category AS child JOIN subtree ON child.parent_id = subtree.id
    ),
    base AS (${select})`
      : sql`
    WITH base AS (${select})`;

  const [pageRows, [{ count } = { count: 0 }]] = await Promise.all([
    db.execute<RawProductRow>(sql`
      ${base}
      SELECT * FROM base ${keyset}
      ORDER BY ${sortColumn} ${order}, id ${order}
      LIMIT ${limit + 1}`),
    db.execute<{ count: number }>(sql`${base} SELECT count(*)::int AS count FROM base`),
  ]);

  const rows = [...pageRows].map(
    (row): ProductListRow => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      descriptionPlaintext: row.descriptionPlaintext,
      categoryId: row.categoryId,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt === null ? null : new Date(row.publishedAt),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      minimalPrice:
        row.minPriceAmount === null
          ? null
          : toMoney(Number(row.minPriceAmount), row.minPriceCurrency ?? ""),
    }),
  );
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
