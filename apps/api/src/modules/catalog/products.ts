import { CURRENCIES, type CurrencyCode, type Money, parseDecimal } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Storage } from "../../storage/index.ts";
import { getCategory, NotFoundError } from "./categories.ts";
import { parseDescription } from "./description.ts";
import { deleteObjectsQuietly, getProductObjectKeys } from "./media.ts";
import { SHOP_CURRENCY } from "./productWhere.ts";
import { generateUniqueSlug, slugTaken } from "./slug.ts";

// Product and variant reads (ARCHITECTURE.md §3 "Catalog"). Products are single-channel (ADR-0005):
// publication lives on the product and the price on each variant (ADR-0013).

export type ProductRow = typeof schema.product.$inferSelect;

/**
 * Catalog's anonymous visibility rule (productGraphql.ts `isVisible`): published, and not
 * scheduled for later. Checkout and draft orders sell only such products.
 */
export function isProductPublished(product: ProductRow): boolean {
  return (
    product.isPublished &&
    (product.publishedAt === null || product.publishedAt.getTime() <= Date.now())
  );
}
export type ProductVariantRow = typeof schema.productVariant.$inferSelect;

/**
 * A variant's stored price as Money. The currency is stored per row so multi-currency stays
 * possible later; an unknown code is corrupt data, never silently treated as MNT.
 */
export function toMoney(amountMinor: number, currency: string): Money {
  if (!Object.hasOwn(CURRENCIES, currency)) {
    throw new Error(`Unknown currency in product_variant: ${currency}`);
  }
  return { amountMinor, currency: currency as CurrencyCode };
}

export async function getProduct(
  db: Executor,
  where: { id: string } | { slug: string },
): Promise<ProductRow | null> {
  const condition =
    "id" in where ? eq(schema.product.id, where.id) : eq(schema.product.slug, where.slug);
  const [row] = await db.select().from(schema.product).where(condition);
  return row ?? null;
}

export async function getProductVariant(
  db: Executor,
  where: { id: string } | { sku: string },
): Promise<ProductVariantRow | null> {
  const condition =
    "id" in where
      ? eq(schema.productVariant.id, where.id)
      : eq(schema.productVariant.sku, where.sku);
  const [row] = await db.select().from(schema.productVariant).where(condition);
  return row ?? null;
}

/** The variants with the given ids; one query for any number of ids, order unspecified. */
export async function getProductVariantsByIds(
  db: Executor,
  ids: readonly string[],
): Promise<ProductVariantRow[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.productVariant)
    .where(inArray(schema.productVariant.id, [...ids]));
}

/** A product's variants in display order: `position`, then `id` so the order is total. */
export async function getProductVariants(
  db: Executor,
  productId: string,
): Promise<ProductVariantRow[]> {
  return db
    .select()
    .from(schema.productVariant)
    .where(eq(schema.productVariant.productId, productId))
    .orderBy(asc(schema.productVariant.position), asc(schema.productVariant.id));
}

/** The cheapest variant's price, or null for a product without variants. */
export async function getMinimalVariantPrice(
  db: Executor,
  productId: string,
): Promise<Money | null> {
  const [row] = await db
    .select({
      amountMinor: schema.productVariant.priceAmount,
      currency: schema.productVariant.currency,
    })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.productId, productId))
    .orderBy(asc(schema.productVariant.priceAmount), asc(schema.productVariant.id))
    .limit(1);
  return row ? toMoney(row.amountMinor, row.currency) : null;
}

// Product and variant mutations (M2.4): Saleor's productCreate/Update/Delete and
// productVariantCreate/Update/Delete, with our publish invariant (ARCHITECTURE.md §3 "Catalog").

// Saleor's ProductErrorCode values our payloads can carry. GRAPHQL_ERROR is the GraphQL layer's
// code for an input it can't resolve (e.g. productVariantCreate's warehouse IDs); the catalog
// functions themselves never return it.
export type ProductErrorCode =
  | "GRAPHQL_ERROR"
  | "INVALID"
  | "PRODUCT_WITHOUT_CATEGORY"
  | "PRODUCT_WITHOUT_VARIANTS"
  | "REQUIRED"
  | "UNIQUE";

export type ProductError = {
  field: string | null;
  code: ProductErrorCode;
  message: string;
};

export type ProductResult =
  | { ok: true; product: ProductRow }
  | { ok: false; errors: ProductError[] };

export type ProductVariantResult =
  | { ok: true; variant: ProductVariantRow }
  | { ok: false; errors: ProductError[] };

export type ProductCreateInput = {
  name: string;
  slug?: string;
  description?: unknown;
  categoryId?: string | null;
  isPublished?: boolean;
};

export type ProductUpdateInput = {
  name?: string;
  slug?: string;
  description?: unknown;
  /** `undefined` leaves the category unchanged; `null` unassigns it. */
  categoryId?: string | null;
  isPublished?: boolean;
};

export type ProductVariantCreateInput = {
  productId: string;
  sku?: string | null;
  name?: string;
  trackInventory?: boolean;
  /** The GraphQL Decimal input, as typed (parsed and checked here). */
  price?: string | null;
};

export type ProductVariantUpdateInput = {
  sku?: string | null;
  name?: string | null;
  trackInventory?: boolean;
  price?: string | null;
};

const MESSAGES = {
  blank: "This field cannot be blank.",
  invalidSlug: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
  blankSlug: "Slug value cannot be blank.",
  slugTaken: "Product with this Slug already exists.",
  invalidDescription: "Invalid EditorJS data.",
  withoutCategory: "You must select a category to be able to publish.",
  withoutVariants: "You must add at least one variant to be able to publish.",
  lastVariant: "Cannot delete the last variant of a published product. Unpublish it first.",
  skuTaken: "Product variant with this SKU already exists.",
  priceRequired: "This field is required.",
  negativePrice: "Price cannot be negative.",
  tooManyDecimals: "Value cannot have more than 0 decimal places.",
  invalidPrice: "Invalid price.",
} as const;

/** A product or variant id that matches no row (the GraphQL layer maps it to `nodesNotFound`). */
export class ProductNotFoundError extends Error {
  readonly kind: "Product" | "ProductVariant";
  readonly ids: string[];

  constructor(kind: "Product" | "ProductVariant", ids: string[]) {
    super(`${kind} not found: ${ids.join(", ")}`);
    this.name = "ProductNotFoundError";
    this.kind = kind;
    this.ids = ids;
  }
}

function nameError(name: string): ProductError | null {
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

function slugError(slug: string): ProductError | null {
  if (slug.length > 255 || !/^[-a-zA-Z0-9_]+$/.test(slug)) {
    return { field: "slug", code: "INVALID", message: MESSAGES.invalidSlug };
  }
  return null;
}

async function requireCategory(db: Executor, id: string): Promise<void> {
  if (!(await getCategory(db, { id }))) throw new NotFoundError([id]);
}

async function variantSkuTaken(db: Executor, sku: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.productVariant.id })
    .from(schema.productVariant)
    .where(
      exceptId
        ? and(eq(schema.productVariant.sku, sku), ne(schema.productVariant.id, exceptId))
        : eq(schema.productVariant.sku, sku),
    );
  return row !== undefined;
}

async function hasVariants(db: Executor, productId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.productVariant.id })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.productId, productId))
    .limit(1);
  return row !== undefined;
}

async function bumpProduct(db: Executor, productId: string): Promise<void> {
  await db
    .update(schema.product)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.product.id, productId));
}

/** A variant sku: trimmed, an empty string stored as NULL (Saleor's clean_variant_sku). */
function normalizeSku(sku: string | null): string | null {
  if (sku === null) return null;
  const trimmed = sku.trim();
  return trimmed === "" ? null : trimmed;
}

/** The GraphQL Decimal input as minor units of the shop currency, or its INVALID error. */
function parsePrice(price: string): { amountMinor: number } | { error: ProductError } {
  try {
    const { amountMinor } = parseDecimal(price, SHOP_CURRENCY);
    if (amountMinor < 0) {
      return { error: { field: "price", code: "INVALID", message: MESSAGES.negativePrice } };
    }
    return { amountMinor };
  } catch (error) {
    return {
      error: {
        field: "price",
        code: "INVALID",
        message: error instanceof RangeError ? MESSAGES.tooManyDecimals : MESSAGES.invalidPrice,
      },
    };
  }
}

/** A product that must exist, locked for the rest of the transaction. */
async function lockProduct(db: Executor, id: string): Promise<ProductRow> {
  const [product] = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.id, id))
    .for("update");
  if (!product) throw new ProductNotFoundError("Product", [id]);
  return product;
}

/**
 * The given variants with their products, locked `FOR KEY SHARE` in variant id order: other
 * transactions can still read and update them, but not delete them or take `FOR UPDATE` until the
 * caller commits. Checkout completion takes this before the stock rows, the same variant-before-stock
 * order the stock writes use (ARCHITECTURE §2 rule 6), so the two can't deadlock.
 */
export async function lockVariantsForKeyShare(
  db: Executor,
  ids: readonly string[],
): Promise<{ variant: ProductVariantRow; product: ProductRow }[]> {
  if (ids.length === 0) return [];
  return db
    .select({ variant: schema.productVariant, product: schema.product })
    .from(schema.productVariant)
    .innerJoin(schema.product, eq(schema.productVariant.productId, schema.product.id))
    .where(inArray(schema.productVariant.id, [...new Set(ids)]))
    .orderBy(asc(schema.productVariant.id))
    .for("key share", { of: schema.productVariant });
}

/**
 * A variant that must exist, locked for the rest of the transaction. Its product row is locked
 * first, the order every variant write uses (product → variant → stock rows), so concurrent
 * variant, product and stock writes can't deadlock. Must be called inside a transaction.
 */
export async function lockProductVariant(
  db: Executor,
  variantId: string,
): Promise<ProductVariantRow> {
  const [existing] = await db
    .select({ productId: schema.productVariant.productId })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.id, variantId));
  if (!existing) throw new ProductNotFoundError("ProductVariant", [variantId]);

  await lockProduct(db, existing.productId);
  const [variant] = await db
    .select()
    .from(schema.productVariant)
    .where(eq(schema.productVariant.id, variantId))
    .for("update");
  if (!variant) throw new ProductNotFoundError("ProductVariant", [variantId]);
  return variant;
}

export async function createProduct(
  db: Executor,
  input: ProductCreateInput,
): Promise<ProductResult> {
  const name = input.name.trim();

  return db.transaction(async (tx) => {
    const errors: ProductError[] = [];
    const invalidName = nameError(name);
    if (invalidName) errors.push(invalidName);

    let slug = input.slug;
    if (slug === undefined || slug === "") {
      if (!invalidName) slug = await generateUniqueSlug(tx, schema.product, name);
    } else {
      const invalidSlug = slugError(slug);
      if (invalidSlug) errors.push(invalidSlug);
      else if (await slugTaken(tx, schema.product, slug)) {
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

    const categoryId = input.categoryId ?? null;
    if (categoryId !== null) await requireCategory(tx, categoryId);

    const isPublished = input.isPublished ?? false;
    // A new product has no variants, so publishing it always violates the invariant.
    if (isPublished) {
      if (categoryId === null) {
        errors.push({
          field: "category",
          code: "PRODUCT_WITHOUT_CATEGORY",
          message: MESSAGES.withoutCategory,
        });
      }
      errors.push({
        field: "isPublished",
        code: "PRODUCT_WITHOUT_VARIANTS",
        message: MESSAGES.withoutVariants,
      });
    }

    if (errors.length > 0) return { ok: false, errors };
    if (!slug) throw new Error("valid product input produced no slug");

    const [product] = await tx
      .insert(schema.product)
      .values({
        name,
        slug,
        description,
        descriptionPlaintext,
        categoryId,
        isPublished,
        publishedAt: isPublished ? sql`now()` : null,
      })
      .returning();
    if (!product) throw new Error("product insert returned no row");
    return { ok: true, product };
  });
}

export async function updateProduct(
  db: Executor,
  id: string,
  input: ProductUpdateInput,
): Promise<ProductResult> {
  return db.transaction(async (tx) => {
    const current = await lockProduct(tx, id);
    const errors: ProductError[] = [];
    const values: Partial<typeof schema.product.$inferInsert> = {};

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
        else if (await slugTaken(tx, schema.product, input.slug, id)) {
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

    let categoryId = current.categoryId;
    if (input.categoryId !== undefined) {
      categoryId = input.categoryId;
      if (categoryId !== null) await requireCategory(tx, categoryId);
      values.categoryId = categoryId;
    }

    const isPublished = input.isPublished ?? current.isPublished;
    if (input.isPublished !== undefined) values.isPublished = isPublished;

    // Saleor's publish rules run when the product is (or stays) published and a publish-relevant
    // field changes; a plain rename of a published product never fails them.
    const checkPublish = input.isPublished === true || (input.categoryId === null && isPublished);
    if (checkPublish) {
      if (categoryId === null) {
        errors.push({
          field: "category",
          code: "PRODUCT_WITHOUT_CATEGORY",
          message: MESSAGES.withoutCategory,
        });
      }
      if (!(await hasVariants(tx, id))) {
        errors.push({
          field: "isPublished",
          code: "PRODUCT_WITHOUT_VARIANTS",
          message: MESSAGES.withoutVariants,
        });
      }
    }

    if (isPublished && !current.isPublished) values.publishedAt = new Date();
    if (!isPublished) values.publishedAt = null;

    if (errors.length > 0) return { ok: false, errors };

    const [product] = await tx
      .update(schema.product)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(schema.product.id, id))
      .returning();
    if (!product) throw new ProductNotFoundError("Product", [id]);
    return { ok: true, product };
  });
}

/**
 * Deletes a product; its variants go with it (`ON DELETE CASCADE`). The product's media and
 * thumbnail objects are deleted after the commit (ADR-0014).
 */
export async function deleteProduct(
  db: Executor,
  storage: Storage,
  id: string,
): Promise<ProductRow> {
  const deleted = await db.transaction(async (tx) => {
    const product = await lockProduct(tx, id);
    const keys = await getProductObjectKeys(tx, [id]);
    await tx.delete(schema.product).where(eq(schema.product.id, id));
    return { product, keys };
  });

  await deleteObjectsQuietly(storage, deleted.keys);
  return deleted.product;
}

/**
 * Deletes several products at once (Saleor's productBulkDelete); their variants and media rows go
 * with them (FK cascade). All ids must exist, as Saleor's get_nodes_or_error; `count` is how many
 * of the given products were deleted (a duplicate id is counted once). The products are locked in
 * id order, the same order as the other product mutations, so bulk deletes can't deadlock. Media
 * and thumbnail objects go after the commit (ADR-0014).
 */
export async function deleteProducts(
  db: Executor,
  storage: Storage,
  ids: string[],
): Promise<{ count: number }> {
  const unique = [...new Set(ids)];

  const deleted = await db.transaction(async (tx) => {
    if (unique.length === 0) return { count: 0, keys: [] as string[] };

    const found = await tx
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(inArray(schema.product.id, unique))
      .orderBy(asc(schema.product.id))
      .for("update");
    const foundIds = new Set(found.map((row) => row.id));
    const missing = unique.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new ProductNotFoundError("Product", missing);

    const keys = await getProductObjectKeys(tx, unique);
    await tx.delete(schema.product).where(inArray(schema.product.id, unique));
    return { count: unique.length, keys };
  });

  await deleteObjectsQuietly(storage, deleted.keys);
  return { count: deleted.count };
}

export async function createProductVariant(
  db: Executor,
  input: ProductVariantCreateInput,
): Promise<ProductVariantResult> {
  return db.transaction(async (tx) => {
    await lockProduct(tx, input.productId);
    const errors: ProductError[] = [];

    const sku = input.sku === undefined || input.sku === null ? null : normalizeSku(input.sku);
    if (sku !== null && (await variantSkuTaken(tx, sku))) {
      errors.push({ field: "sku", code: "UNIQUE", message: MESSAGES.skuTaken });
    }

    let priceAmount: number | null = null;
    if (input.price === undefined || input.price === null) {
      errors.push({ field: "price", code: "REQUIRED", message: MESSAGES.priceRequired });
    } else {
      const parsed = parsePrice(input.price);
      if ("error" in parsed) errors.push(parsed.error);
      else priceAmount = parsed.amountMinor;
    }

    if (errors.length > 0) return { ok: false, errors };
    if (priceAmount === null) throw new Error("valid variant input produced no price");

    const [last] = await tx
      .select({ position: sql<number | null>`max(${schema.productVariant.position})` })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, input.productId));
    const position = (last?.position ?? -1) + 1;

    const [variant] = await tx
      .insert(schema.productVariant)
      .values({
        productId: input.productId,
        sku,
        name: input.name ?? "",
        priceAmount,
        currency: SHOP_CURRENCY,
        position,
        ...(input.trackInventory === undefined ? {} : { trackInventory: input.trackInventory }),
      })
      .returning();
    if (!variant) throw new Error("product variant insert returned no row");
    await bumpProduct(tx, input.productId);
    return { ok: true, variant };
  });
}

export async function updateProductVariant(
  db: Executor,
  id: string,
  input: ProductVariantUpdateInput,
): Promise<ProductVariantResult> {
  return db.transaction(async (tx) => {
    // The product row is locked before the variant, in the same order as deleteProductVariant,
    // so the two can't deadlock (bumpProduct below writes the product row).
    await lockProductVariant(tx, id);

    const errors: ProductError[] = [];
    const values: Partial<typeof schema.productVariant.$inferInsert> = {};

    if (input.sku !== undefined) {
      const sku = normalizeSku(input.sku);
      if (sku !== null && (await variantSkuTaken(tx, sku, id))) {
        errors.push({ field: "sku", code: "UNIQUE", message: MESSAGES.skuTaken });
      } else {
        values.sku = sku;
      }
    }

    if (input.price !== undefined && input.price !== null) {
      const parsed = parsePrice(input.price);
      if ("error" in parsed) errors.push(parsed.error);
      else values.priceAmount = parsed.amountMinor;
    }

    if (input.name !== undefined && input.name !== null) values.name = input.name;
    if (input.trackInventory !== undefined) values.trackInventory = input.trackInventory;

    if (errors.length > 0) return { ok: false, errors };

    const [variant] = await tx
      .update(schema.productVariant)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(schema.productVariant.id, id))
      .returning();
    if (!variant) throw new ProductNotFoundError("ProductVariant", [id]);
    await bumpProduct(tx, variant.productId);
    return { ok: true, variant };
  });
}

/**
 * Deletes a variant. The product row is locked first, so the last-variant check and a concurrent
 * publish can't both pass (Saleor has no such rule; ours is ARCHITECTURE.md §3).
 */
export async function deleteProductVariant(
  db: Executor,
  id: string,
): Promise<ProductVariantResult> {
  return db.transaction(async (tx) => {
    const variant = await lockProductVariant(tx, id);
    const product = await getProduct(tx, { id: variant.productId });
    if (!product) throw new ProductNotFoundError("Product", [variant.productId]);

    if (product.isPublished) {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.productVariant)
        .where(eq(schema.productVariant.productId, product.id));
      if ((row?.count ?? 0) <= 1) {
        return {
          ok: false,
          errors: [
            { field: null, code: "PRODUCT_WITHOUT_VARIANTS", message: MESSAGES.lastVariant },
          ],
        };
      }
    }

    await tx.delete(schema.productVariant).where(eq(schema.productVariant.id, id));
    await bumpProduct(tx, product.id);
    return { ok: true, variant };
  });
}
