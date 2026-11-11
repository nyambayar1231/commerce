import { type Executor, schema } from "@commerce/db";
import DataLoader from "dataloader";
import { asc, inArray } from "drizzle-orm";
import type { ThumbnailFormat } from "../../storage/index.ts";
import type { CategoryRow } from "./categories.ts";
import type { ProductMediaRow, ProductMediaThumbnailRow } from "./media.ts";
import type { ProductRow, ProductVariantRow } from "./products.ts";

// Per-request batch loaders for the catalog's nested fields (ARCHITECTURE.md §4 and §5.1 step 5):
// each loader coalesces the N lookups of one GraphQL field into a single `WHERE … IN (…)` query.
// Keys are row UUIDs. As DataLoader's batch contract requires, every batch returns one value per
// key in the same order; a missing id is `null` (or `[]` for the variant list), never an error.

/** The key of `thumbnailByMediaIdSizeFormat`: one generated thumbnail per media, size and format. */
export type ThumbnailLoaderKey = {
  mediaId: string;
  size: number;
  format: ThumbnailFormat;
};

export interface CatalogLoaders {
  /** `Product.category` and `Category.parent`. */
  categoryById: DataLoader<string, CategoryRow | null>;
  /** `ProductVariant.product`. Visibility is still checked by the resolver. */
  productById: DataLoader<string, ProductRow | null>;
  /** `Product.variants`, `Product.defaultVariant` and `Product.minimalVariantPrice`. */
  variantsByProductId: DataLoader<string, ProductVariantRow[]>;
  /** `Product.media`. */
  mediaByProductId: DataLoader<string, ProductMediaRow[]>;
  /** `ProductMedia.url` and `Product.thumbnail`: the stored thumbnail of a media, if generated. */
  thumbnailByMediaIdSizeFormat: DataLoader<ThumbnailLoaderKey, ProductMediaThumbnailRow | null>;
}

/** The DataLoader cache key of a thumbnail lookup. */
const thumbnailKeyOf = (mediaId: string, size: number, format: string) =>
  `${mediaId}:${size}:${format}`;

/** Loaders live for exactly one request: create them in `createContext`, never globally. */
export function createCatalogLoaders(db: Executor): CatalogLoaders {
  return {
    categoryById: new DataLoader(async (ids) => {
      const rows = await db
        .select()
        .from(schema.category)
        .where(inArray(schema.category.id, [...ids]));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? null);
    }),

    productById: new DataLoader(async (ids) => {
      const rows = await db
        .select()
        .from(schema.product)
        .where(inArray(schema.product.id, [...ids]));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? null);
    }),

    variantsByProductId: new DataLoader(async (productIds) => {
      const rows = await db
        .select()
        .from(schema.productVariant)
        .where(inArray(schema.productVariant.productId, [...productIds]))
        .orderBy(asc(schema.productVariant.position), asc(schema.productVariant.id));
      const byProduct = new Map<string, ProductVariantRow[]>();
      for (const row of rows) {
        const variants = byProduct.get(row.productId);
        if (variants) variants.push(row);
        else byProduct.set(row.productId, [row]);
      }
      return productIds.map((productId) => byProduct.get(productId) ?? []);
    }),

    mediaByProductId: new DataLoader(async (productIds) => {
      const rows = await db
        .select()
        .from(schema.productMedia)
        .where(inArray(schema.productMedia.productId, [...productIds]))
        .orderBy(asc(schema.productMedia.sortOrder), asc(schema.productMedia.id));
      const byProduct = new Map<string, ProductMediaRow[]>();
      for (const row of rows) {
        const media = byProduct.get(row.productId);
        if (media) media.push(row);
        else byProduct.set(row.productId, [row]);
      }
      return productIds.map((productId) => byProduct.get(productId) ?? []);
    }),

    thumbnailByMediaIdSizeFormat: new DataLoader<
      ThumbnailLoaderKey,
      ProductMediaThumbnailRow | null,
      string
    >(
      async (keys) => {
        const mediaIds = [...new Set(keys.map((key) => key.mediaId))];
        const rows =
          mediaIds.length === 0
            ? []
            : await db
                .select()
                .from(schema.productMediaThumbnail)
                .where(inArray(schema.productMediaThumbnail.mediaId, mediaIds));
        const byKey = new Map(
          rows.map((row) => [thumbnailKeyOf(row.mediaId, row.size, row.format), row]),
        );
        return keys.map(
          (key) => byKey.get(thumbnailKeyOf(key.mediaId, key.size, key.format)) ?? null,
        );
      },
      { cacheKeyFn: (key) => thumbnailKeyOf(key.mediaId, key.size, key.format) },
    ),
  };
}
