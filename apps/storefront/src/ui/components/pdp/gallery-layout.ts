// Adapted from saleor-storefront: src/ui/components/pdp/gallery-layout.ts and src/lib/images.ts (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

// The PDP's one layout (ARCHITECTURE §10.18: no template registry — one shop, one layout):
// Paper's "immersive" page — a super-wide gallery column with the description under it, and a
// sticky buy-box column beside it. The shell, the islands, the fallbacks and the route skeleton
// all take their classes from here so they can never disagree.

/** Sticky offset that clears the (sticky) header with a small gap. */
const STICKY_BELOW_HEADER = "lg:top-[calc(var(--header-height)_+_2rem)]";

/** The page's main wrapper and grid. */
export const PDP_LAYOUT = {
  main: "container-super-wide flex-1 py-4 sm:py-6",
  grid: "flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,30rem)] lg:items-start lg:gap-12",
  galleryColumn: "order-1 min-w-0 lg:col-start-1 lg:row-start-1",
  infoColumn: `order-2 flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky ${STICKY_BELOW_HEADER} lg:self-start`,
  /** The description, under the images in the wide column (immersive / on.com style). */
  attributesGalleryBlock: "order-3 mt-10 min-w-0 lg:col-start-1 lg:row-start-2 lg:mt-12",
} as const;

/** The main stage's `sizes`: full width on mobile, the wide gallery column on desktop. */
export const PDP_MAIN_IMAGE_SIZES = "(max-width: 1024px) 100vw, 60vw";

/** The declared intrinsic dimensions of the stage's 4:5 box. */
export const PDP_MAIN_IMAGE_WIDTH = 1024;
export const PDP_MAIN_IMAGE_HEIGHT = 1280;

/** The thumbnail strip's box (h-20 w-20). */
export const PDP_THUMB_IMAGE_SIZE = 80;
