// The search route's loading state: the same skeleton as the results island's fallback in
// `page.tsx`, shown while the route module itself loads.

import { ProductsGridSkeleton } from "@/ui/components/plp/products-grid-skeleton";

export default function Loading() {
  return (
    <div aria-hidden="true">
      <div className="container-content pt-8">
        <div className="h-9 w-64 max-w-full animate-pulse rounded bg-muted" />
        <div className="mt-4 h-4 w-40 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <ProductsGridSkeleton itemCount={24} className="pt-4" />
    </div>
  );
}
