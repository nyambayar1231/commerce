// Adapted from saleor-storefront: src/ui/components/plp/plp-listing-client.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { FilterOptionsView, ListingParams, ListingView } from "@/lib/catalog/types";
import { Pagination } from "@/ui/components/pagination";
import { FilterBar, hasListingFilters } from "./filter-bar";
import { PlpEmptyFilterResults } from "./plp-empty-filter-results";
import { ProductGrid } from "./product-grid";

interface PlpResultsProps {
  /** The page's own path: the filter form's target. */
  basePath: string;
  /** The listing's current, normalized URL state (the selects' and inputs' values). */
  params: ListingParams;
  options: FilterOptionsView;
  listing: ListingView;
  /** The select this page hides: the route is that category or collection. */
  hide: "category" | "collection" | null;
  /** A URL that clears the filters but keeps the sort. */
  clearHref: string;
  previousHref: string | null;
  nextHref: string | null;
}

/**
 * A listing's results area as a server component: the filter bar, then the grid (or the right
 * empty state), then cursor pagination. The page island resolves all data and URLs and passes
 * view models in; nothing here calls a loader.
 */
export function PlpResults({
  basePath,
  params,
  options,
  listing,
  hide,
  clearHref,
  previousHref,
  nextHref,
}: PlpResultsProps) {
  const t = useTranslations("plp");
  const filtered = hasListingFilters(params);

  return (
    <>
      <FilterBar
        basePath={basePath}
        params={params}
        options={options}
        hide={hide}
        clearHref={clearHref}
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
            <ProductGrid items={listing.items} />
          )}
          <Pagination previousHref={previousHref} nextHref={nextHref} />
        </div>
      </div>
    </>
  );
}
