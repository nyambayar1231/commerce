import { type Executor, schema } from "@commerce/db";
import { and, eq } from "drizzle-orm";
import sharp, { type Sharp } from "sharp";
import { logger } from "../../logger.ts";
import { type Storage, type ThumbnailFormat, thumbnailKey } from "../../storage/index.ts";
import { ProductMediaNotFoundError, type ProductMediaThumbnailRow } from "./media.ts";

// Saleor's thumbnail sizes, rounding and on-demand generation (saleor/thumbnail/__init__.py and
// utils.py, ADR-0014). The available sizes are fixed; a requested size rounds to one of them.

export const THUMBNAIL_SIZES = [32, 64, 128, 256, 512, 1024, 2048, 4096] as const;

/** Saleor's `DEFAULT_THUMBNAIL_SIZE`: the size used when none is requested. */
export const DEFAULT_THUMBNAIL_SIZE = 4096;

/** Saleor's `ThumbnailSizeRoundingEnum` values. */
export type ThumbnailSizeRounding = "NEAREST" | "UP";

/** The GraphQL format of a URL path segment; no segment is ORIGINAL. Null when unsupported. */
export function parseThumbnailUrlFormat(segment: string | null): ThumbnailFormat | null {
  if (segment === null) return "ORIGINAL";
  const value = segment.toLowerCase();
  if (value === "avif") return "AVIF";
  if (value === "webp") return "WEBP";
  return null;
}

/** The URL path segment of a format, or null when no segment is needed (ORIGINAL). */
export function thumbnailUrlFormat(format: ThumbnailFormat): string | null {
  return format === "ORIGINAL" ? null : format.toLowerCase();
}

/**
 * Saleor's `get_thumbnail_size`: the available size closest to `size` (NEAREST), or the smallest
 * one not below it (UP). Ties round down, as Python's `min` does. Out-of-range values resolve to
 * the first or last available size.
 */
export function getThumbnailSize(
  size: number | null | undefined,
  rounding: ThumbnailSizeRounding = "NEAREST",
): number {
  const requested = size ?? DEFAULT_THUMBNAIL_SIZE;
  if ((THUMBNAIL_SIZES as readonly number[]).includes(requested)) return requested;

  if (rounding === "UP") {
    return THUMBNAIL_SIZES.find((available) => available >= requested) ?? DEFAULT_THUMBNAIL_SIZE;
  }

  let best: number = THUMBNAIL_SIZES[0];
  for (const available of THUMBNAIL_SIZES) {
    // Strict `<` keeps the first (smaller) size when two are equally close.
    if (Math.abs(available - requested) < Math.abs(best - requested)) best = available;
  }
  return best;
}

/** The image is over sharp's default pixel limit; Saleor's `ImageTooLargeError`. */
export class ImageTooLargeError extends Error {
  constructor() {
    super("Input image exceeds pixel limit");
    this.name = "ImageTooLargeError";
  }
}

/** The original cannot be decoded as an image; Saleor's `ValueError` branch. */
export class InvalidImageError extends Error {
  constructor(cause?: unknown) {
    super("Invalid image", { cause });
    this.name = "InvalidImageError";
  }
}

type OutputFormat = {
  ext: string;
  contentType: string;
  encode: (image: Sharp) => Sharp;
};

// ORIGINAL keeps the source format (Saleor's ProcessedImage qualities and flags).
const ORIGINAL_FORMATS: Record<string, OutputFormat> = {
  jpeg: {
    ext: "jpg",
    contentType: "image/jpeg",
    encode: (image) => image.jpeg({ quality: 70, progressive: true }),
  },
  png: { ext: "png", contentType: "image/png", encode: (image) => image.png() },
  // `sharp` reads the first frame only unless `animated` is set, as Saleor's GIF output.
  gif: { ext: "gif", contentType: "image/gif", encode: (image) => image.gif() },
  webp: {
    ext: "webp",
    contentType: "image/webp",
    encode: (image) => image.webp({ quality: 70 }),
  },
};

function isPixelLimitError(error: unknown): boolean {
  return error instanceof Error && /pixel limit/i.test(error.message);
}

/**
 * Encodes a thumbnail that fits inside `size`x`size` (never enlarged), with the EXIF orientation
 * applied. ORIGINAL keeps the source format; WEBP and AVIF use Saleor's quality of 70. sharp's
 * default `limitInputPixels` is deliberately kept as the decompression-bomb guard.
 */
export async function renderThumbnail(
  mediaId: string,
  original: Uint8Array,
  size: number,
  format: ThumbnailFormat,
): Promise<{ key: string; bytes: Uint8Array; contentType: string }> {
  try {
    const metadata = await sharp(original).metadata();

    let output: OutputFormat;
    if (format === "ORIGINAL") {
      const found = metadata.format === undefined ? undefined : ORIGINAL_FORMATS[metadata.format];
      if (found === undefined) {
        throw new InvalidImageError(new Error(`Unsupported image format: ${metadata.format}`));
      }
      output = found;
    } else {
      const ext = format.toLowerCase();
      output = {
        ext,
        contentType: `image/${ext}`,
        encode:
          format === "WEBP"
            ? (image) => image.webp({ quality: 70 })
            : (image) => image.avif({ quality: 70 }),
      };
    }

    const pipeline = sharp(original)
      .rotate()
      .resize(size, size, { fit: "inside", withoutEnlargement: true });
    const { data } = await output.encode(pipeline).toBuffer({ resolveWithObject: true });
    return {
      key: thumbnailKey(mediaId, size, format, format === "ORIGINAL" ? output.ext : undefined),
      bytes: new Uint8Array(data),
      contentType: output.contentType,
    };
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    if (isPixelLimitError(error)) throw new ImageTooLargeError();
    throw new InvalidImageError(error);
  }
}

async function thumbnailRow(
  db: Executor,
  mediaId: string,
  size: number,
  format: ThumbnailFormat,
): Promise<ProductMediaThumbnailRow | null> {
  const [row] = await db
    .select()
    .from(schema.productMediaThumbnail)
    .where(
      and(
        eq(schema.productMediaThumbnail.mediaId, mediaId),
        eq(schema.productMediaThumbnail.size, size),
        eq(schema.productMediaThumbnail.format, format),
      ),
    );
  return row ?? null;
}

async function mediaExists(db: Executor, mediaId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.productMedia.id })
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, mediaId));
  return row !== undefined;
}

/**
 * The stored thumbnail row of a media at `size`/`format`, generating and storing it first when it
 * does not exist (Saleor's `/thumbnail/` view, ADR-0014). The object is written before the row;
 * when the row insert fails because the media was deleted meanwhile, the object is deleted again
 * and `ProductMediaNotFoundError` is thrown. Two concurrent first requests both succeed: the
 * insert ignores a duplicate and the row is read back.
 */
export async function getOrCreateThumbnail(
  db: Executor,
  storage: Storage,
  mediaId: string,
  size: number,
  format: ThumbnailFormat,
): Promise<ProductMediaThumbnailRow> {
  const existing = await thumbnailRow(db, mediaId, size, format);
  if (existing) return existing;

  const [media] = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, mediaId));
  if (!media) throw new ProductMediaNotFoundError([mediaId]);

  const original = await storage.getObject(media.imageKey);
  const generated = await renderThumbnail(mediaId, original, size, format);
  await storage.putObject(generated.key, generated.bytes, generated.contentType);

  const discardObject = async () => {
    try {
      await storage.deleteObject(generated.key);
    } catch (error) {
      logger.error(
        { err: error, key: generated.key },
        "Failed to delete an orphan thumbnail object",
      );
    }
  };

  try {
    await db
      .insert(schema.productMediaThumbnail)
      .values({ mediaId, size, format, imageKey: generated.key })
      .onConflictDoNothing();
  } catch (error) {
    await discardObject();
    // A foreign key failure means the media was deleted after our read.
    if (!(await mediaExists(db, mediaId))) throw new ProductMediaNotFoundError([mediaId]);
    throw error;
  }

  const row = await thumbnailRow(db, mediaId, size, format);
  if (!row) {
    await discardObject();
    throw new ProductMediaNotFoundError([mediaId]);
  }
  return row;
}
