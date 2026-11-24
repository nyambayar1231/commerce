// Adapted from saleor-storefront: src/ui/components/plp/products-grid-skeleton.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { cn } from "@/lib/utils";

/** One page of a listing is 24 cards; the skeleton reserves the same grid. */
const LISTING_PAGE_SIZE = 24;

interface ProductsGridSkeletonProps {
  className?: string;
  itemCount?: number;
}

/** The grid's placeholder: the same column layout, pulsing cells of a card's shape. */
export function ProductsGridSkeleton({
  className,
  itemCount = LISTING_PAGE_SIZE,
}: ProductsGridSkeletonProps) {
  return (
    <div className={cn("container-content py-8", className)}>
      <div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6"
        data-testid="ProductListSkeleton"
      >
        {Array.from({ length: itemCount }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: identical static skeleton cells; the index is their only identity and the list never reorders.
            key={i}
            className="animate-pulse"
          >
            <div className="mb-4 aspect-[3/4] rounded-card bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
