import { type Executor, schema } from "@commerce/db";
import type { SQL } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";
import { toGlobalId } from "../../graphql/globalId.ts";
import { InvalidCursorError, type OrderDirection } from "./categoryList.ts";
import { parseDescription } from "./description.ts";
import { generateUniqueSlug, slugTaken } from "./slug.ts";

// Saleor's `product.Collection` (saleor/product/models.py): staff group products into collections
// ("Featured", "Summer sale") that the storefront shows by slug. Single channel like products
// (ADR-0005): publication lives on the collection, and a collection's `published_at` is the
// moment it was first published. The product links live in `collection_product`; their manual
// order (Saleor's CollectionProduct.sort_order) is not modelled — the list sorts by product count.

export type CollectionRow = typeof schema.collection.$inferSelect;

// Saleor's CollectionErrorCode (saleor/product/error_codes.py), minus the file and
// product-without-variant codes we can't produce yet.
export type CollectionErrorCode =
  | "DUPLICATED_INPUT_ITEM"
  | "GRAPHQL_ERROR"
  | "INVALID"
  | "NOT_FOUND"
  | "REQUIRED"
  | "UNIQUE";

export type CollectionError = {
  field: string | null;
  code: CollectionErrorCode;
  message: string;
};

export type CollectionResult =
  | { ok: true; collection: CollectionRow }
  | { ok: false; errors: CollectionError[] };

export type CollectionProductsResult =
  | { ok: true; collection: CollectionRow }
  | { ok: false; errors: CollectionError[] };

export type CollectionCreateInput = {
  name: string;
  slug?: string;
  description?: unknown;
  isPublished?: boolean;
  /** Product primary keys to link; the same id twice is linked once. */
  products?: readonly string[];
};

export type CollectionUpdateInput = {
  name?: string;
  slug?: string;
  description?: unknown;
  isPublished?: boolean;
};

const MESSAGES = {
  blank: "This field cannot be blank.",
  invalidSlug: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
  blankSlug: "Slug value cannot be blank.",
  slugTaken: "Collection with this Slug already exists.",
  invalidDescription: "Invalid EditorJS data.",
} as const;

/** A collection id that matches no row (the GraphQL layer maps it to `nodesNotFound`). */
export class CollectionNotFoundError extends Error {
  readonly kind = "Collection";
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Collection not found: ${ids.join(", ")}`);
    this.name = "CollectionNotFoundError";
    this.ids = ids;
  }
}

function nameError(name: string): CollectionError | null {
  if (name === "") return { field: "name", code: "REQUIRED", message: MESSAGES.blank };
  if (name.length > 250) {
    return {
      field: "name",
      code: "INVALID",
      message: `Ensure this value has at most 250 characters (it has ${name.length}).`,
    };
  }
  return null;
}

function slugError(slug: string): CollectionError | null {
  if (slug.length > 255 || !/^[-a-zA-Z0-9_]+$/.test(slug)) {
    return { field: "slug", code: "INVALID", message: MESSAGES.invalidSlug };
  }
  return null;
}

/**
 * A collection's visibility to the public: published, and not scheduled for later. The same rule
 * as `isProductPublished`; staff with MANAGE_PRODUCTS see every collection.
 */
export function isCollectionPublished(collection: CollectionRow): boolean {
  return (
    collection.isPublished &&
    (collection.publishedAt === null || collection.publishedAt.getTime() <= Date.now())
  );
}

export async function getCollection(
  db: Executor,
  where: { id: string } | { slug: string },
): Promise<CollectionRow | null> {
  const condition =
    "id" in where ? eq(schema.collection.id, where.id) : eq(schema.collection.slug, where.slug);
  const [row] = await db.select().from(schema.collection).where(condition);
  return row ?? null;
}

async function requireCollection(db: Executor, id: string): Promise<CollectionRow> {
  const row = await getCollection(db, { id });
  if (!row) throw new CollectionNotFoundError([id]);
  return row;
}

/** The ids of `ids` that match no product, in the given order. */
async function missingProductIds(db: Executor, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const found = await db
    .select({ id: schema.product.id })
    .from(schema.product)
    .where(inArray(schema.product.id, [...ids]));
  const present = new Set(found.map((row) => row.id));
  return ids.filter((id) => !present.has(id));
}

/** Saleor's get_nodes_or_error: unknown nodes are one NOT_FOUND error on the argument. */
const productsNotFound = (ids: readonly string[]): CollectionError => ({
  field: "products",
  code: "NOT_FOUND",
  message: `Couldn't resolve to a node: ${ids.map((id) => toGlobalId("Product", id)).join(", ")}.`,
});

const collectionNotFound = (id: string): CollectionError => ({
  field: "collectionId",
  code: "NOT_FOUND",
  message: `Couldn't resolve to a node: ${toGlobalId("Collection", id)}`,
});

export async function createCollection(
  db: Executor,
  input: CollectionCreateInput,
): Promise<CollectionResult> {
  const name = input.name.trim();

  return db.transaction(async (tx) => {
    const errors: CollectionError[] = [];
    const invalidName = nameError(name);
    if (invalidName) errors.push(invalidName);

    let slug = input.slug;
    if (slug === undefined || slug === "") {
      if (!invalidName) slug = await generateUniqueSlug(tx, schema.collection, name);
    } else {
      const invalidSlug = slugError(slug);
      if (invalidSlug) errors.push(invalidSlug);
      else if (await slugTaken(tx, schema.collection, slug)) {
        errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
      }
    }

    let description: unknown = null;
    let descriptionPlaintext = "";
    if (input.description !== undefined) {
      const parsed = parseDescription(input.description);
      if (!parsed) {
        errors.push({
          field: "description",
          code: "INVALID",
          message: MESSAGES.invalidDescription,
        });
      } else {
        description = parsed.value;
        descriptionPlaintext = parsed.plaintext;
      }
    }

    const products = [...new Set(input.products ?? [])];
    const missingProducts = await missingProductIds(tx, products);
    if (missingProducts.length > 0) errors.push(productsNotFound(missingProducts));

    if (errors.length > 0) return { ok: false, errors };
    if (!slug) throw new Error("valid collection input produced no slug");

    // A collection (unlike a product) needs nothing but a name to be published: it always has a
    // page, with no products when none are linked yet.
    const isPublished = input.isPublished ?? false;
    const [collection] = await tx
      .insert(schema.collection)
      .values({
        name,
        slug,
        description,
        descriptionPlaintext,
        isPublished,
        publishedAt: isPublished ? sql`now()` : null,
      })
      .returning();
    if (!collection) throw new Error("collection insert returned no row");

    if (products.length > 0) {
      await tx
        .insert(schema.collectionProduct)
        .values(products.map((productId) => ({ collectionId: collection.id, productId })))
        .onConflictDoNothing();
    }
    return { ok: true, collection };
  });
}

export async function updateCollection(
  db: Executor,
  id: string,
  input: CollectionUpdateInput,
): Promise<CollectionResult> {
  return db.transaction(async (tx) => {
    const current = await requireCollection(tx, id);
    const errors: CollectionError[] = [];
    const values: Partial<typeof schema.collection.$inferInsert> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      const invalidName = nameError(name);
      if (invalidName) errors.push(invalidName);
      else values.name = name;
    }

    if (input.slug !== undefined) {
      if (input.slug === "") {
        errors.push({ field: "slug", code: "INVALID", message: MESSAGES.blankSlug });
      } else {
        const invalidSlug = slugError(input.slug);
        if (invalidSlug) errors.push(invalidSlug);
        else if (await slugTaken(tx, schema.collection, input.slug, id)) {
          errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
        } else {
          values.slug = input.slug;
        }
      }
    }

    if (input.description !== undefined) {
      const parsed = parseDescription(input.description);
      if (!parsed) {
        errors.push({
          field: "description",
          code: "INVALID",
          message: MESSAGES.invalidDescription,
        });
      } else {
        values.description = parsed.value;
        values.descriptionPlaintext = parsed.plaintext;
      }
    }

    // Saleor's publish rules, as products: a first publication stamps published_at, and
    // unpublishing clears it so the next publication stamps a new date.
    const isPublished = input.isPublished ?? current.isPublished;
    if (input.isPublished !== undefined) values.isPublished = isPublished;
    if (isPublished && !current.isPublished) values.publishedAt = new Date();
    if (!isPublished) values.publishedAt = null;

    if (errors.length > 0) return { ok: false, errors };

    const [collection] = await tx
      .update(schema.collection)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(schema.collection.id, id))
      .returning();
    if (!collection) throw new CollectionNotFoundError([id]);
    return { ok: true, collection };
  });
}

/** Deletes a collection; its products stay, only the links go (`ON DELETE CASCADE`). */
export async function deleteCollection(db: Executor, id: string): Promise<CollectionRow> {
  return db.transaction(async (tx) => {
    const [collection] = await tx
      .delete(schema.collection)
      .where(eq(schema.collection.id, id))
      .returning();
    if (!collection) throw new CollectionNotFoundError([id]);
    return collection;
  });
}

/**
 * Deletes several collections at once (Saleor's collectionBulkDelete); their product links go with
 * them, the products stay. All ids must exist, as Saleor's get_nodes_or_error; `count` is how many
 * of the given collections were deleted (a duplicate id is counted once).
 */
export async function deleteCollections(db: Executor, ids: string[]): Promise<{ count: number }> {
  const unique = [...new Set(ids)];

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: schema.collection.id })
      .from(schema.collection)
      .where(inArray(schema.collection.id, unique));
    const foundIds = new Set(found.map((row) => row.id));
    const missing = unique.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new CollectionNotFoundError(missing);

    if (unique.length > 0) {
      await tx.delete(schema.collection).where(inArray(schema.collection.id, unique));
    }
    return { count: unique.length };
  });
}

/**
 * Links products to a collection (Saleor's collectionAddProducts). Adding a product that is
 * already in the collection is a no-op, duplicates in the input are linked once. An unknown
 * collection or product changes nothing. The collection's `updated_at` moves either way.
 */
export async function addCollectionProducts(
  db: Executor,
  collectionId: string,
  productIds: readonly string[],
): Promise<CollectionProductsResult> {
  return db.transaction(async (tx) => {
    if (!(await getCollection(tx, { id: collectionId }))) {
      return { ok: false, errors: [collectionNotFound(collectionId)] };
    }

    const products = [...new Set(productIds)];
    const missing = await missingProductIds(tx, products);
    if (missing.length > 0) return { ok: false, errors: [productsNotFound(missing)] };

    if (products.length > 0) {
      await tx
        .insert(schema.collectionProduct)
        .values(products.map((productId) => ({ collectionId, productId })))
        .onConflictDoNothing();
    }
    return { ok: true, collection: await bumpCollection(tx, collectionId) };
  });
}

/**
 * Unlinks products from a collection (Saleor's collectionRemoveProducts). Removing a product that
 * isn't in the collection is a no-op, duplicates in the input are removed once. An unknown
 * collection or product changes nothing. The collection's `updated_at` moves either way.
 */
export async function removeCollectionProducts(
  db: Executor,
  collectionId: string,
  productIds: readonly string[],
): Promise<CollectionProductsResult> {
  return db.transaction(async (tx) => {
    if (!(await getCollection(tx, { id: collectionId }))) {
      return { ok: false, errors: [collectionNotFound(collectionId)] };
    }

    const products = [...new Set(productIds)];
    const missing = await missingProductIds(tx, products);
    if (missing.length > 0) return { ok: false, errors: [productsNotFound(missing)] };

    if (products.length > 0) {
      await tx
        .delete(schema.collectionProduct)
        .where(
          and(
            eq(schema.collectionProduct.collectionId, collectionId),
            inArray(schema.collectionProduct.productId, products),
          ),
        );
    }
    return { ok: true, collection: await bumpCollection(tx, collectionId) };
  });
}

/** Moves `updated_at` and returns the bumped row. */
async function bumpCollection(db: Executor, id: string): Promise<CollectionRow> {
  const [collection] = await db
    .update(schema.collection)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.collection.id, id))
    .returning();
  if (!collection) throw new CollectionNotFoundError([id]);
  return collection;
}

// Saleor's `collections` connection (saleor/graphql/core/connection.py): filtered, sorted,
// keyset-paginated. The cursor format, the InvalidCursorError and the page-info rules are the same
// as `categories` (categoryList.ts). Sorting always tie-breaks by id, so pages never overlap or
// skip rows.

export type CollectionSortField = "NAME" | "AVAILABILITY" | "PRODUCT_COUNT";

export type CollectionPublished = "PUBLISHED" | "HIDDEN";

export interface CollectionListArgs {
  search?: string | null;
  /** Collection primary keys; an explicitly empty list matches nothing. */
  ids?: readonly string[] | null;
  /** Narrows staff results only; the public always sees just the visible collections. */
  published?: CollectionPublished | null;
  /** Staff with MANAGE_PRODUCTS see unpublished and future-dated collections too. */
  includeUnpublished?: boolean;
  sort?: { field: CollectionSortField; direction: OrderDirection } | null;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export type CollectionListRow = CollectionRow & { productCount: number };

export interface CollectionPage {
  rows: { cursor: string; node: CollectionListRow }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sortValue = (row: CollectionListRow, field: CollectionSortField): string => {
  switch (field) {
    case "NAME":
      return row.name;
    case "AVAILABILITY":
      return row.isPublished ? "1" : "0";
    case "PRODUCT_COUNT":
      return String(row.productCount);
  }
};

const encodeCursor = (row: CollectionListRow, field: CollectionSortField): string =>
  Buffer.from(JSON.stringify([sortValue(row, field), row.id])).toString("base64");

function decodeCursor(cursor: string, field: CollectionSortField): [string | number, string] {
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
  if (field === "AVAILABILITY") {
    if (parsed[0] !== "0" && parsed[0] !== "1") throw new InvalidCursorError();
    return [Number(parsed[0]), parsed[1]];
  }
  if (field === "PRODUCT_COUNT") {
    const count = Number(parsed[0]);
    if (!Number.isInteger(count) || count < 0) throw new InvalidCursorError();
    return [count, parsed[1]];
  }
  return [parsed[0], parsed[1]];
}

/** Rows as the raw query returns them: timestamps arrive as Date, counts as int. */
type RawCollectionListRow = CollectionRow & {
  product_count: number;
};

export async function listCollections(
  db: Executor,
  args: CollectionListArgs,
): Promise<CollectionPage> {
  const field = args.sort?.field ?? "NAME";
  const direction = args.sort?.direction ?? "ASC";
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;

  const filters: SQL[] = [];
  // Saleor's collection visibility, as products: published and not scheduled for later. Staff
  // with MANAGE_PRODUCTS skip it and may narrow by `published` instead.
  if (!args.includeUnpublished) {
    filters.push(sql`c.is_published AND (c.published_at IS NULL OR c.published_at <= now())`);
  } else if (args.published) {
    filters.push(sql`c.is_published = ${args.published === "PUBLISHED"}`);
  }
  if (args.search?.trim()) {
    const pattern = `%${args.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(sql`(c.name ILIKE ${pattern} OR c.slug ILIKE ${pattern})`);
  }
  // Saleor's CollectionFilterInput.ids: exact primary keys. An explicit empty list matches
  // nothing (Saleor's `filter_by_ids` returns an empty queryset), while an absent `ids` is no
  // condition at all.
  if (args.ids != null) {
    filters.push(
      args.ids.length === 0
        ? sql`FALSE`
        : sql`c.id IN (${sql.join(
            args.ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
    );
  }
  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

  const sortColumn: SQL = {
    NAME: sql`name`,
    AVAILABILITY: sql`"isPublished"::int`,
    PRODUCT_COUNT: sql`product_count`,
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

  const base = sql`
    WITH base AS (
      SELECT
        c.id, c.name, c.slug, c.description,
        c.description_plaintext AS "descriptionPlaintext",
        c.is_published AS "isPublished", c.published_at AS "publishedAt",
        c.created_at AS "createdAt", c.updated_at AS "updatedAt",
        (SELECT count(*) FROM collection_product AS cp WHERE cp.collection_id = c.id)::int
          AS product_count
      FROM collection AS c
      ${where}
    )`;

  const [pageRows, [{ count } = { count: 0 }]] = await Promise.all([
    db.execute<RawCollectionListRow>(sql`
      ${base}
      SELECT * FROM base ${keyset}
      ORDER BY ${sortColumn} ${order}, id ${order}
      LIMIT ${limit + 1}`),
    db.execute<{ count: number }>(sql`${base} SELECT count(*)::int AS count FROM base`),
  ]);

  const rows = [...pageRows].map(({ product_count, ...row }) => ({
    ...row,
    publishedAt: row.publishedAt === null ? null : new Date(row.publishedAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    productCount: product_count,
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
