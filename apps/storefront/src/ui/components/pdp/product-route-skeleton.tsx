// Adapted from saleor-storefront: src/ui/components/pdp/product-route-skeleton.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { cn } from "@/lib/utils";
import { PDP_LAYOUT } from "./gallery-layout";
import { ProductGalleryShell } from "./product-gallery-shell";

interface ProductRouteSkeletonProps {
  /** The accessible name of the loading state (from messages; never hard-coded). */
  label: string;
  /**
   * Where the skeleton renders:
   * - `"route"`: route `loading.tsx` during client navigations — it replaces the whole page,
   *   so it wraps itself in the main container.
   * - `"page"`: the page-level Suspense fallback, inside the shell's main container.
   */
  surface?: "route" | "page";
}

function BreadcrumbSkeleton() {
  return (
    <div className="mb-6 hidden sm:block" aria-hidden="true">
      <div className="flex items-center gap-2">
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/** The gallery column's placeholder: the stage box with the chrome the live gallery shows. */
function GallerySkeleton() {
  return (
    <ProductGalleryShell imageCount={4}>
      <div className="aspect-[4/5] w-full animate-pulse rounded-lg bg-muted" />
    </ProductGalleryShell>
  );
}

/** The buy box's placeholder: price line, a row of variant pills, the button bar. */
function BuyBoxSkeleton() {
  return (
    <div className="order-3 mt-4 animate-pulse space-y-6" aria-hidden="true">
      <div className="space-y-4">
        <div className="h-8 w-24 rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-12 w-24 rounded-lg bg-muted" />
          <div className="h-12 w-24 rounded-lg bg-muted" />
          <div className="h-12 w-24 rounded-lg bg-muted" />
        </div>
        <div className="h-14 w-full rounded bg-muted" />
      </div>
    </div>
  );
}

/** The description block's placeholder, under the gallery column. */
function DescriptionSkeleton() {
  return (
    <div className={cn(PDP_LAYOUT.attributesGalleryBlock, "space-y-3")} aria-hidden="true">
      <div className="h-6 w-24 rounded bg-muted" />
      <div className="h-4 w-full max-w-2xl rounded bg-muted" />
      <div className="h-4 w-full max-w-xl rounded bg-muted" />
      <div className="h-4 w-full max-w-2xl rounded bg-muted" />
    </div>
  );
}

/**
 * The PDP's skeleton for the route `loading.tsx` and the page-level Suspense fallback. Sized
 * like the live page (Paper's route skeleton): breadcrumb bar, the gallery stage with its
 * chrome, the name bar and buy-box pulses in the info column, the description lines under the
 * gallery.
 */
export function ProductRouteSkeleton({ label, surface = "page" }: ProductRouteSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={surface === "route" ? PDP_LAYOUT.main : undefined}
    >
      <BreadcrumbSkeleton />
      <div className={PDP_LAYOUT.grid}>
        <div className={PDP_LAYOUT.galleryColumn}>
          <GallerySkeleton />
        </div>

        <div className={PDP_LAYOUT.infoColumn}>
          <div className="order-2 h-10 w-3/4 max-w-md animate-pulse rounded bg-muted" />
          <BuyBoxSkeleton />
        </div>

        <DescriptionSkeleton />
      </div>
    </div>
  );
}
