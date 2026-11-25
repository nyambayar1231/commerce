import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { addToCart } from "@/lib/cart/actions";
import { getCollection } from "@/lib/catalog/collections";
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

// One collection's products. Same shape as the category page: a synchronous shell, the islands
// resolve the slug and await `searchParams`, an unknown slug is a 404.

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (collection === null) notFound();
  return {
    title: collection.name,
    alternates: { canonical: `${getEnv().storefrontUrl}/collections/${collection.slug}` },
  };
}

export default function CollectionPage({ params, searchParams }: PageProps) {
  return (
    <>
      <Suspense fallback={<PlpHeaderSkeleton />}>
        <CollectionHeader params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<PlpListingSkeleton />}>
        <CollectionResults params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** The hero: the collection's name and the count under the current filters. */
async function CollectionHeader({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const [collection, t] = await Promise.all([getCollection(slug), getTranslations("plp")]);
  if (collection === null) notFound();
  const listing = await getProductListing(
    { kind: "collection", id: collection.id, slug: collection.slug },
    parseListingParams(search),
  );

  return (
    <CategoryHero title={collection.name}>
      <p className="text-lead text-muted-foreground">
        {t("productCount", { count: listing.totalCount ?? 0 })}
      </p>
    </CategoryHero>
  );
}

/** The results, scoped to the collection: the collection select is hidden, the category one kept. */
async function CollectionResults({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const [collection, options] = await Promise.all([getCollection(slug), getFilterOptions()]);
  if (collection === null) notFound();

  const listingParams = parseListingParams(search);
  const scope = { kind: "collection" as const, id: collection.id, slug: collection.slug };
  const listing = await getProductListing(scope, listingParams);
  const basePath = `/collections/${collection.slug}`;
  const { previousHref, nextHref } = paginationHrefs(basePath, listingParams, listing.pageInfo);
  const clearHref = listingHref(basePath, listingParams, {
    category: undefined,
    collection: undefined,
    minPrice: undefined,
    maxPrice: undefined,
  });

  return (
    <PlpResults
      basePath={basePath}
      params={listingParams}
      options={options}
      listing={listing}
      hide="collection"
      clearHref={clearHref}
      previousHref={previousHref}
      nextHref={nextHref}
      addAction={addToCart}
    />
  );
}
