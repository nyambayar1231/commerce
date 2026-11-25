// Adapted from saleor-storefront: src/ui/components/pdp/gallery-utils.ts (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ProductView, ProductViewImage, VariantView } from "@/lib/catalog/types";

// The PDP's variant selection rules, pure over the page's view model. The page's islands call
// these after reading `?variant=` in their own Suspense boundary; the shell never reads it.

/** What Next.js hands a page as `searchParams` (also what a GET form submits). */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * The `?variant=` param, normalized: the first value when repeated, and empty treated as
 * missing (a bare `?variant=` selects nothing, like no param at all).
 */
export function variantParam(searchParams: RawSearchParams): string | undefined {
  const raw = searchParams.variant;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === undefined || value === "" ? undefined : value;
}

/**
 * The selected variant: a product with one variant always has it selected (there is nothing to
 * choose); with several, only an exact id match selects one — an unknown or missing id selects
 * none, and the buy box shows the price range instead.
 */
export function resolveSelectedVariant(
  product: ProductView,
  param: string | undefined,
): VariantView | null {
  if (product.variants.length === 1) return product.variants[0] ?? null;
  if (param === undefined) return null;
  return product.variants.find((variant) => variant.id === param) ?? null;
}

/**
 * The gallery's images: the selected variant's own media first, the rest of the product's
 * media after them. The set never changes — a variant only reorders it — so the Suspense
 * fallback and the streamed gallery occupy the same box.
 */
export function getGalleryImages(
  product: ProductView,
  selected: VariantView | null,
): ProductViewImage[] {
  if (selected === null || selected.mediaIds.length === 0) return product.images;
  const own = new Set(selected.mediaIds);
  const variantImages = product.images.filter((image) => own.has(image.id));
  if (variantImages.length === 0) return product.images;
  const rest = product.images.filter((image) => !own.has(image.id));
  return [...variantImages, ...rest];
}
