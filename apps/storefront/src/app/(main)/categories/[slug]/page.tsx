import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { addToCart } from "@/lib/cart/actions";
import { getCategory } from "@/lib/catalog/categories";
import { getFilterOptions, getProductListing } from "@/lib/catalog/listing";
import {
  listingHref,
  paginationHrefs,
  parseListingParams,
  type RawSearchParams,
} from "@/lib/catalog/listing-params";
import { getEnv } from "@/lib/env";
import { descriptionOrUndefined } from "@/lib/seo/description";
import { getCategoryDescription } from "@/lib/seo/descriptions-data";
import { CategoryHero } from "@/ui/components/plp/category-hero";
import { PlpHeaderSkeleton, PlpListingSkeleton } from "@/ui/components/plp/plp-page-loading";
import { PlpResults } from "@/ui/components/plp/plp-results";

// One category and its descendants (the API's `where.category` includes them). A synchronous
// shell; the islands resolve the slug and await `searchParams`. An unknown slug is a 404 —
// decided by `generateMetadata` and by the islands, never cached as one.

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [category, description] = await Promise.all([
    getCategory(slug),
    getCategoryDescription(slug),
  ]);
  if (category === null) notFound();
  return {
    title: category.name,
    description: descriptionOrUndefined(description),
    alternates: { canonical: `${getEnv().storefrontUrl}/categories/${category.slug}` },
  };
}

export default function CategoryPage({ params, searchParams }: PageProps) {
  return (
    <>
      <Suspense fallback={<PlpHeaderSkeleton />}>
        <CategoryHeader params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<PlpListingSkeleton />}>
        <CategoryResults params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** The hero: the category's name, the count under the current filters, and its child links. */
async function CategoryHeader({ params, searchParams }: PageProps) {
  const [{ slug }, search, t] = await Promise.all([params, searchParams, getTranslations("plp")]);
  const category = await getCategory(slug);
  if (category === null) notFound();
  const listing = await getProductListing(
    { kind: "category", id: category.id, slug: category.slug },
    parseListingParams(search),
  );

  return (
    <CategoryHero title={category.name}>
      <p className="text-lead text-muted-foreground">
        {t("productCount", { count: listing.totalCount ?? 0 })}
      </p>
      {category.children.length > 0 && (
        <nav aria-label={t("childCategories")} className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {category.children.map((child) => (
            <Link
              key={child.slug}
              href={`/categories/${child.slug}`}
              className="text-lead text-foreground underline underline-offset-4"
            >
              {child.name}
            </Link>
          ))}
        </nav>
      )}
    </CategoryHero>
  );
}

/** The results, scoped to the category: the category select is hidden, the collection one kept. */
async function CategoryResults({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const [category, options] = await Promise.all([getCategory(slug), getFilterOptions()]);
  if (category === null) notFound();

  const listingParams = parseListingParams(search);
  const scope = { kind: "category" as const, id: category.id, slug: category.slug };
  const listing = await getProductListing(scope, listingParams);
  const basePath = `/categories/${category.slug}`;
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
      hide="category"
      clearHref={clearHref}
      previousHref={previousHref}
      nextHref={nextHref}
      addAction={addToCart}
    />
  );
}
