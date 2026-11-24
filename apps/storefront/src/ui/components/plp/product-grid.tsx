// Adapted from saleor-storefront: src/ui/components/plp/product-grid.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ProductCardView } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { PLP_IMAGE_SIZES, ProductCard } from "./product-card";

/** Eager-loading cards on the first row-and-a-half of the grid (the LCP rung). */
const PRIORITY_CARDS = 4;

interface ProductGridProps {
  items: ProductCardView[];
  imageSizes?: string;
  className?: string;
}

/**
 * The product grid as a `<ul>`: 2 columns, 3 from 640px, 4 from 1024px (matching the card's
 * `sizes`), each cell one card — one link whose accessible name is the product name.
 */
export function ProductGrid({ items, imageSizes = PLP_IMAGE_SIZES, className }: ProductGridProps) {
  return (
    <ul
      className={cn(
        "grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6",
        className,
      )}
      data-testid="ProductList"
    >
      {items.map((product, index) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            priority={index < PRIORITY_CARDS}
            imageSizes={imageSizes}
          />
        </li>
      ))}
    </ul>
  );
}
