import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { addToCart } from "@/lib/cart/actions";
import { buildFilterBarView } from "@/lib/catalog/filter-bar-view";
import { getFilterOptions, getProductListing } from "@/lib/catalog/listing";
import {
  listingHref,
  paginationHrefs,
  parseListingParams,
  type RawSearchParams,
} from "@/lib/catalog/listing-params";
import { getEnv } from "@/lib/env";
import { CategoryHero } from "@/ui/components/plp/category-hero";
import { PlpHeaderSkeleton, PlpListingSkeleton } from "@/ui/components/plp/plp-page-loading";
import { PlpResults } from "@/ui/components/plp/plp-results";

// All products, one grid. A synchronous shell (so it prerenders); the header and the results
// are separate islands that await `searchParams` (ARCHITECTURE §10.4, §10.7).

const BASE_PATH = "/products";

type SearchParams = Promise<RawSearchParams>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plp");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: `${getEnv().storefrontUrl}${BASE_PATH}` },
  };
}

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <Suspense fallback={<PlpHeaderSkeleton />}>
        <ProductsHeader />
      </Suspense>
      <Suspense fallback={<PlpListingSkeleton />}>
        <ProductsResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** The hero: the page's name and Paper's subtitle (the count is in the filter bar). */
async function ProductsHeader() {
  const t = await getTranslations("plp");
  return (
    <CategoryHero title={t("title")}>
      <p className="text-lead text-muted-foreground">{t("description")}</p>
    </CategoryHero>
  );
}

/** The filter bar, the grid and the pagination for the current URL state. */
async function ProductsResults({ searchParams }: { searchParams: SearchParams }) {
  const [params, options] = await Promise.all([
    searchParams.then(parseListingParams),
    getFilterOptions(),
  ]);
  const listing = await getProductListing({ kind: "all" }, params);
  const { previousHref, nextHref } = paginationHrefs(BASE_PATH, params, listing.pageInfo);
  const clearHref = listingHref(BASE_PATH, params, {
    category: undefined,
    collection: undefined,
    minPrice: undefined,
    maxPrice: undefined,
  });
  return (
    <PlpResults
      params={params}
      filterView={buildFilterBarView(BASE_PATH, params, options, null)}
      listing={listing}
      clearHref={clearHref}
      previousHref={previousHref}
      nextHref={nextHref}
      addAction={addToCart}
    />
  );
}
