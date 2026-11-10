import { type Executor, schema } from "@commerce/db";
import { asc, eq } from "drizzle-orm";

// Product media reads (ADR-0014). Uploads, deletions and thumbnails arrive with M2.5.2.

export type ProductMediaRow = typeof schema.productMedia.$inferSelect;
export type ProductMediaThumbnailRow = typeof schema.productMediaThumbnail.$inferSelect;

/** A product's media in display order: `sort_order`, then `id` so the order is total. */
export async function getProductMedia(db: Executor, productId: string): Promise<ProductMediaRow[]> {
  return db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, productId))
    .orderBy(asc(schema.productMedia.sortOrder), asc(schema.productMedia.id));
}
