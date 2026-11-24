// Adapted from saleor-storefront: src/ui/components/plp/plp-page-loading.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { cn } from "@/lib/utils";
import { ProductsGridSkeleton } from "./products-grid-skeleton";

/** The hero block's placeholder: the same 340px band, title and meta lines bottom-aligned. */
export function PlpHeaderSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-hidden="true"
      className={cn(
        "relative h-[340px] overflow-hidden border-b border-border bg-muted",
        className,
      )}
    >
      <div className="container-content relative flex h-full flex-col justify-end pb-10">
        <div className="h-9 w-64 max-w-full animate-pulse rounded bg-muted-foreground/10" />
        <div className="mt-5 h-5 w-40 max-w-full animate-pulse rounded bg-muted-foreground/10" />
      </div>
    </section>
  );
}

/** The filter bar's placeholder: the same sticky band, one pulsing row of controls. */
function PlpBarSkeleton() {
  return (
    <div aria-hidden="true" className="sticky top-16 z-30 border-b border-border bg-background">
      <div className="container-content flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
        <div className="h-9 w-40 animate-pulse rounded-button bg-muted" />
        <div className="h-9 w-40 animate-pulse rounded-button bg-muted" />
        <div className="h-9 w-56 animate-pulse rounded-button bg-muted" />
        <div className="h-9 w-44 animate-pulse rounded-button bg-muted" />
        <div className="h-9 w-20 animate-pulse rounded-button bg-muted" />
      </div>
    </div>
  );
}

/**
 * The grid island's placeholder: the bar plus a page of pulsing cards, so the swap causes no
 * layout shift. Delayed visibility avoids a flash on fast cached loads.
 */
export function PlpListingSkeleton() {
  return (
    <div className="animate-skeleton-delayed opacity-0">
      <PlpBarSkeleton />
      <ProductsGridSkeleton />
    </div>
  );
}

/**
 * A whole listing page's placeholder (`loading.tsx` and route transitions): the hero, the bar
 * and a page of pulsing cards, each sized like the real thing.
 */
export function PlpPageLoading() {
  return (
    <div className="animate-skeleton-delayed-long opacity-0">
      <PlpHeaderSkeleton />
      <PlpListingSkeleton />
    </div>
  );
}
