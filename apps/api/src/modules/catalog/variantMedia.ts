import { type Executor, schema } from "@commerce/db";
import { and, eq } from "drizzle-orm";
import { toGlobalId } from "../../graphql/globalId.ts";
import type { ProductMediaRow } from "./media.ts";
import type { ProductErrorCode, ProductVariantRow } from "./products.ts";

// Saleor's VariantMedia (product/models.py): a variant's chosen images, linked from its product's
// media. Nothing is uploaded here; a row only points at an existing `product_media` row.

/** The variant media codes extend the product ones with Saleor's MEDIA_ALREADY_ASSIGNED. */
export type VariantMediaErrorCode =
  | ProductErrorCode
  | "MEDIA_ALREADY_ASSIGNED"
  | "NOT_FOUND"
  | "NOT_PRODUCTS_IMAGE";

export type VariantMediaError = {
  field: string | null;
  code: VariantMediaErrorCode;
  message: string;
};

export type VariantMediaResult =
  | { ok: true; variant: ProductVariantRow; media: ProductMediaRow }
  | { ok: false; errors: VariantMediaError[] };

const MESSAGES = {
  foreignMedia: "This media doesn't belong to that product.",
  alreadyAssigned: "This media is already assigned",
  notAssigned: "Media is not assigned to this variant.",
} as const;

const error = (
  field: string | null,
  code: VariantMediaErrorCode,
  message: string,
): VariantMediaError => ({ field, code, message });

/** Saleor's get_node_or_error: an unknown node is a NOT_FOUND payload error on its argument. */
const notFound = (field: "mediaId" | "variantId", type: string, id: string): VariantMediaError =>
  error(field, "NOT_FOUND", `Couldn't resolve to a node: ${toGlobalId(type, id)}`);

type LoadedNodes =
  | { ok: false; error: VariantMediaError }
  | { ok: true; media: ProductMediaRow; variant: ProductVariantRow };

/** The media and variant a mutation names, or the matching NOT_FOUND error. */
async function loadNodes(db: Executor, mediaId: string, variantId: string): Promise<LoadedNodes> {
  const [media] = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, mediaId));
  if (!media) return { ok: false, error: notFound("mediaId", "ProductMedia", mediaId) };

  const [variant] = await db
    .select()
    .from(schema.productVariant)
    .where(eq(schema.productVariant.id, variantId));
  if (!variant) return { ok: false, error: notFound("variantId", "ProductVariant", variantId) };
  return { ok: true, media, variant };
}

/**
 * Assigns a product media to a variant (Saleor's variantMediaAssign). The media must belong to
 * the variant's product. The insert relies on the unique constraint, not a check-then-insert, so
 * two concurrent assigns can't create two rows: the loser gets MEDIA_ALREADY_ASSIGNED.
 */
export async function assignVariantMedia(
  db: Executor,
  mediaId: string,
  variantId: string,
): Promise<VariantMediaResult> {
  return db.transaction(async (tx) => {
    const nodes = await loadNodes(tx, mediaId, variantId);
    if (!nodes.ok) return { ok: false, errors: [nodes.error] };
    const { media, variant } = nodes;

    if (media.productId !== variant.productId) {
      return { ok: false, errors: [error("mediaId", "NOT_PRODUCTS_IMAGE", MESSAGES.foreignMedia)] };
    }

    const [assigned] = await tx
      .insert(schema.variantMedia)
      .values({ variantId, mediaId })
      .onConflictDoNothing()
      .returning({ id: schema.variantMedia.id });
    if (!assigned) {
      return {
        ok: false,
        errors: [error("mediaId", "MEDIA_ALREADY_ASSIGNED", MESSAGES.alreadyAssigned)],
      };
    }
    return { ok: true, variant, media };
  });
}

/**
 * Unassigns a product media from a variant (Saleor's variantMediaUnassign). The delete is the
 * check: a link that isn't there returns Saleor's NOT_PRODUCTS_IMAGE.
 */
export async function unassignVariantMedia(
  db: Executor,
  mediaId: string,
  variantId: string,
): Promise<VariantMediaResult> {
  return db.transaction(async (tx) => {
    const nodes = await loadNodes(tx, mediaId, variantId);
    if (!nodes.ok) return { ok: false, errors: [nodes.error] };
    const { media, variant } = nodes;

    const [deleted] = await tx
      .delete(schema.variantMedia)
      .where(
        and(eq(schema.variantMedia.variantId, variantId), eq(schema.variantMedia.mediaId, mediaId)),
      )
      .returning({ id: schema.variantMedia.id });
    if (!deleted) {
      return { ok: false, errors: [error("mediaId", "NOT_PRODUCTS_IMAGE", MESSAGES.notAssigned)] };
    }
    return { ok: true, variant, media };
  });
}
