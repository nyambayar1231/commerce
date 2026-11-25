// Adapted from saleor-storefront: src/ui/sections/featured-collection-section/featured-collection-skeleton.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ProductsGridSkeleton } from "@/ui/components/plp/products-grid-skeleton";

/** The featured section island's placeholder: a heading pulse and eight card-shaped cells. */
export function FeaturedCollectionSkeleton() {
  return (
    <section className="bg-background py-section-lg" aria-hidden="true">
      <div className="container-content">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
      <ProductsGridSkeleton className="pt-6" itemCount={8} />
    </section>
  );
}
