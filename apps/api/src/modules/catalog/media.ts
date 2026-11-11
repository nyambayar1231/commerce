import { type Executor, schema } from "@commerce/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { toGlobalId } from "../../graphql/globalId.ts";
import { productMediaKey, type Storage } from "../../storage/index.ts";
import { type UploadedFile, validateImageFile } from "./mediaFile.ts";
import {
  getProduct,
  type ProductErrorCode,
  ProductNotFoundError,
  type ProductRow,
} from "./products.ts";

// Product media reads and mutations (ADR-0014). The bytes live in S3 under keys derived from the
// row's id; the row is the source of truth, so objects are written before the row (create) and
// deleted after it (delete).

export type ProductMediaRow = typeof schema.productMedia.$inferSelect;
export type ProductMediaThumbnailRow = typeof schema.productMediaThumbnail.$inferSelect;

/** The image upload codes extend the product ones; `ProductErrorCode` is in `products.ts`. */
export type ProductMediaErrorCode =
  | ProductErrorCode
  | "FILE_SIZE_LIMIT_EXCEEDED"
  | "INVALID_FILE_TYPE"
  | "NOT_PRODUCTS_IMAGE"
  | "UNSUPPORTED_MIME_TYPE";

export type ProductMediaError = {
  field: string | null;
  code: ProductMediaErrorCode;
  message: string;
};

export type ProductMediaResult =
  | { ok: true; product: ProductRow; media: ProductMediaRow }
  | { ok: false; errors: ProductMediaError[] };

export type ProductMediaReorderResult =
  | { ok: true; product: ProductRow; media: ProductMediaRow[] }
  | { ok: false; errors: ProductMediaError[] };

export type ProductMediaCreateInput = {
  productId: string;
  /** Saleor stores an absent alt as "". */
  alt?: string | null;
  /** The uploaded image, or null when the mutation carries none. */
  file: UploadedFile | null;
};

export type ProductMediaUpdateInput = {
  /** `undefined` or `null` leaves the alt unchanged, as Saleor's `input.get("alt") is not None`. */
  alt?: string | null;
};

/** Saleor's `ALT_CHAR_LIMIT` (saleor/graphql/product/utils.py). */
const ALT_MAX_LENGTH = 250;

const MESSAGES = {
  altTooLong: `Alt field exceeds the character limit of ${ALT_MAX_LENGTH}.`,
  // Saleor has no image-only variant of this message: `mediaUrl` is simply not in our input.
  imageRequired: "Image or external URL is required.",
  wrongMediaCount: "Incorrect number of media IDs provided.",
  foreignMedia: (globalId: string) => `Media ${globalId} does not belong to this product.`,
} as const;

/** A product media id that matches no row (the GraphQL layer maps it to `nodesNotFound`). */
export class ProductMediaNotFoundError extends Error {
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`ProductMedia not found: ${ids.join(", ")}`);
    this.name = "ProductMediaNotFoundError";
    this.ids = ids;
  }
}

const mediaError = (
  field: string | null,
  code: ProductMediaErrorCode,
  message: string,
): ProductMediaError => ({ field, code, message });

/** A product's media in display order: `sort_order`, then `id` so the order is total. */
export async function getProductMedia(db: Executor, productId: string): Promise<ProductMediaRow[]> {
  return db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, productId))
    .orderBy(asc(schema.productMedia.sortOrder), asc(schema.productMedia.id));
}

/**
 * A product that must exist, locked for the rest of the transaction. The media mutations lock the
 * product before a media row, the same order as the variant mutations, so they can't deadlock.
 */
async function lockProduct(db: Executor, id: string): Promise<ProductRow> {
  const [product] = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.id, id))
    .for("update");
  if (!product) throw new ProductNotFoundError("Product", [id]);
  return product;
}

/** The media row of `id`, locked, with its product already locked by the caller. */
async function lockMedia(db: Executor, id: string): Promise<ProductMediaRow> {
  const [media] = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, id))
    .for("update");
  if (!media) throw new ProductMediaNotFoundError([id]);
  return media;
}

/**
 * The object keys of a set of products' media and their thumbnails. Read inside the transaction
 * that deletes the rows, so the keys describe exactly what is about to go (ADR-0014).
 */
export async function getProductObjectKeys(db: Executor, productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];

  const media = await db
    .select({ id: schema.productMedia.id, imageKey: schema.productMedia.imageKey })
    .from(schema.productMedia)
    .where(inArray(schema.productMedia.productId, productIds));
  if (media.length === 0) return [];

  const thumbnails = await db
    .select({ imageKey: schema.productMediaThumbnail.imageKey })
    .from(schema.productMediaThumbnail)
    .where(
      inArray(
        schema.productMediaThumbnail.mediaId,
        media.map((row) => row.id),
      ),
    );
  return [...media.map((row) => row.imageKey), ...thumbnails.map((row) => row.imageKey)];
}

/**
 * Deletes object keys after their rows committed. A failed delete is logged and never thrown: an
 * orphan object is harmless, a mutation failing after the commit is not (ADR-0014).
 */
export async function deleteObjectsQuietly(storage: Storage, keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await storage.deleteObject(key);
    } catch (error) {
      console.error(`Failed to delete a product media object: ${key}`, error);
    }
  }
}

/** The keys of a media row's thumbnail objects (their rows cascade with the media row). */
async function thumbnailKeys(db: Executor, mediaId: string): Promise<string[]> {
  const rows = await db
    .select({ imageKey: schema.productMediaThumbnail.imageKey })
    .from(schema.productMediaThumbnail)
    .where(eq(schema.productMediaThumbnail.mediaId, mediaId));
  return rows.map((row) => row.imageKey);
}

/**
 * Creates a product image (Saleor's productMediaCreate, image branch). No transaction is open
 * while S3 is written: the object is put first, keyed by an id the database generates, then the
 * row is inserted with that id; if the insert fails (e.g. the product was deleted meanwhile) the
 * object is deleted again, so a failed create leaves nothing behind.
 */
export async function createProductMedia(
  db: Executor,
  storage: Storage,
  input: ProductMediaCreateInput,
): Promise<ProductMediaResult> {
  // Saleor's `validate_media_input` checks the missing file before the alt length.
  if (input.file === null) {
    return { ok: false, errors: [mediaError("input", "REQUIRED", MESSAGES.imageRequired)] };
  }
  const alt = input.alt ?? "";
  if (alt.length > ALT_MAX_LENGTH) {
    return { ok: false, errors: [mediaError("input", "INVALID", MESSAGES.altTooLong)] };
  }

  const validated = await validateImageFile(input.file);
  if (!validated.ok) return { ok: false, errors: [validated.error] };
  const { bytes, contentType, ext } = validated.image;

  // Checked before the S3 write; the transaction below repeats it under the product's lock, so a
  // product deleted in between still fails with the same not-found error.
  if (!(await getProduct(db, { id: input.productId }))) {
    throw new ProductNotFoundError("Product", [input.productId]);
  }

  // The row's id before the insert, so the object key and the row share one id (ADR-0014 keys).
  const [generated] = await db.execute<{ id: string }>(sql`select uuidv7() as id`);
  if (!generated) throw new Error("uuidv7() returned no row");
  const id = generated.id;
  const key = productMediaKey(input.productId, id, ext);
  await storage.putObject(key, bytes, contentType);

  try {
    return await db.transaction(async (tx) => {
      const product = await lockProduct(tx, input.productId);
      const [last] = await tx
        .select({ sortOrder: sql<number | null>`max(${schema.productMedia.sortOrder})` })
        .from(schema.productMedia)
        .where(eq(schema.productMedia.productId, input.productId));
      const sortOrder = (last?.sortOrder ?? -1) + 1;

      const [media] = await tx
        .insert(schema.productMedia)
        .values({
          id,
          productId: input.productId,
          imageKey: key,
          contentType,
          alt,
          sortOrder,
        })
        .returning();
      if (!media) throw new Error("product media insert returned no row");
      return { ok: true, product, media };
    });
  } catch (error) {
    // A row pointing at a missing object is worse than an orphan object, but this one is ours:
    // the create failed, so remove it. Best effort: the original error is what the caller sees.
    try {
      await storage.deleteObject(key);
    } catch (deleteError) {
      console.error(`Failed to delete the object of a failed media create: ${key}`, deleteError);
    }
    throw error;
  }
}

/** Updates a product media's alt text (Saleor's productMediaUpdate). */
export async function updateProductMedia(
  db: Executor,
  id: string,
  input: ProductMediaUpdateInput,
): Promise<ProductMediaResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ productId: schema.productMedia.productId })
      .from(schema.productMedia)
      .where(eq(schema.productMedia.id, id));
    if (!existing) throw new ProductMediaNotFoundError([id]);

    const product = await lockProduct(tx, existing.productId);
    const current = await lockMedia(tx, id);

    if (input.alt === undefined || input.alt === null) return { ok: true, product, media: current };
    if (input.alt.length > ALT_MAX_LENGTH) {
      return { ok: false, errors: [mediaError("input", "INVALID", MESSAGES.altTooLong)] };
    }

    const [media] = await tx
      .update(schema.productMedia)
      .set({ alt: input.alt, updatedAt: sql`now()` })
      .where(eq(schema.productMedia.id, id))
      .returning();
    if (!media) throw new ProductMediaNotFoundError([id]);
    return { ok: true, product, media };
  });
}

/**
 * Deletes a product media row (Saleor's productMediaDelete), then its object and its thumbnails'
 * objects. The objects go after the commit: a failed delete is logged and never fails the
 * mutation (an orphan object is harmless, ADR-0014).
 */
export async function deleteProductMedia(
  db: Executor,
  storage: Storage,
  id: string,
): Promise<{ product: ProductRow; media: ProductMediaRow }> {
  const deleted = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ productId: schema.productMedia.productId })
      .from(schema.productMedia)
      .where(eq(schema.productMedia.id, id));
    if (!existing) throw new ProductMediaNotFoundError([id]);

    const product = await lockProduct(tx, existing.productId);
    const media = await lockMedia(tx, id);
    const keys = [media.imageKey, ...(await thumbnailKeys(tx, id))];

    await tx.delete(schema.productMedia).where(eq(schema.productMedia.id, id));
    return { product, media, keys };
  });

  await deleteObjectsQuietly(storage, deleted.keys);
  return { product: deleted.product, media: deleted.media };
}

/**
 * Reorders a product's media (Saleor's productMediaReorder): `mediaIds` must be exactly the
 * product's media, and each row's `sort_order` becomes its position in the list. A wrong count is
 * Saleor's INVALID error; an id of another product or a duplicate is NOT_PRODUCTS_IMAGE.
 */
export async function reorderProductMedia(
  db: Executor,
  productId: string,
  mediaIds: string[],
): Promise<ProductMediaReorderResult> {
  return db.transaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    const rows = await tx
      .select()
      .from(schema.productMedia)
      .where(eq(schema.productMedia.productId, productId));

    if (mediaIds.length !== rows.length) {
      return { ok: false, errors: [mediaError("order", "INVALID", MESSAGES.wrongMediaCount)] };
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const seen = new Set<string>();
    for (const id of mediaIds) {
      if (!byId.has(id) || seen.has(id)) {
        // Saleor names the media by the global ID the mutation was given.
        const globalId = toGlobalId("ProductMedia", id);
        return {
          ok: false,
          errors: [mediaError("order", "NOT_PRODUCTS_IMAGE", MESSAGES.foreignMedia(globalId))],
        };
      }
      seen.add(id);
    }

    const media: ProductMediaRow[] = [];
    for (const [sortOrder, id] of mediaIds.entries()) {
      const row = byId.get(id);
      if (!row) throw new ProductMediaNotFoundError([id]);
      if (row.sortOrder === sortOrder) {
        media.push(row);
        continue;
      }
      const [updated] = await tx
        .update(schema.productMedia)
        .set({ sortOrder, updatedAt: sql`now()` })
        .where(eq(schema.productMedia.id, id))
        .returning();
      if (!updated) throw new ProductMediaNotFoundError([id]);
      media.push(updated);
    }
    return { ok: true, product, media };
  });
}
