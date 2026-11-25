// Adapted from saleor-storefront: src/ui/components/plp/plp-listing-client.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { AddToCartAction } from "@/lib/cart/types";
import type { FilterBarView, ListingParams, ListingView } from "@/lib/catalog/types";
import { Pagination } from "@/ui/components/pagination";
import { FilterBar, hasListingFilters } from "./filter-bar";
import { PlpEmptyFilterResults } from "./plp-empty-filter-results";
import { ProductGrid } from "./product-grid";

interface PlpResultsProps {
  /** The listing's current, normalized URL state (which options are selected). */
  params: ListingParams;
  /** The filter bar's options and their URLs (`buildFilterBarView`). */
  filterView: FilterBarView;
  listing: ListingView;
  /** A URL that clears the filters but keeps the sort. */
  clearHref: string;
  previousHref: string | null;
  nextHref: string | null;
  /** The `addToCart` Server Action for the cards' quick-add buttons. */
  addAction: AddToCartAction;
}

/**
 * A listing's results area as a server component: the filter bar, then the grid (or the right
 * empty state), then cursor pagination. The page island resolves all data and URLs and passes
 * view models in; nothing here calls a loader.
 */
export function PlpResults({
  params,
  filterView,
  listing,
  clearHref,
  previousHref,
  nextHref,
  addAction,
}: PlpResultsProps) {
  const t = useTranslations("plp");
  const filtered = hasListingFilters(params);

  return (
    <>
      <FilterBar
        view={filterView}
        filtered={filtered}
        clearHref={clearHref}
        totalCount={listing.totalCount}
      />
      <div className="w-full">
        <div className="container-content py-8">
          {listing.items.length === 0 ? (
            filtered ? (
              <PlpEmptyFilterResults clearHref={clearHref} />
            ) : (
              <p className="py-12 text-center text-lg text-muted-foreground">{t("emptyCatalog")}</p>
            )
          ) : (
            <ProductGrid items={listing.items} addAction={addAction} />
          )}
          <Pagination previousHref={previousHref} nextHref={nextHref} />
        </div>
      </div>
    </>
  );
}
