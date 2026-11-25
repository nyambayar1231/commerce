import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { addToCart } from "@/lib/cart/actions";
import type { RawSearchParams } from "@/lib/catalog/listing-params";
import { parseSearchPageParams, searchProducts } from "@/lib/catalog/search";
import { Pagination } from "@/ui/components/pagination";
import { ProductGrid } from "@/ui/components/plp/product-grid";
import { ProductsGridSkeleton } from "@/ui/components/plp/products-grid-skeleton";
import { buttonClassName } from "@/ui/components/ui/button";

// Product search (ARCHITECTURE §10.4, §10.7): dynamic and `noindex`, uncached through
// `sessionQuery`. An empty `q` makes no API call — the page shows the search prompt instead.

type SearchParams = Promise<RawSearchParams>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [t, search] = await Promise.all([getTranslations("search"), searchParams]);
  const { q } = parseSearchPageParams(search);
  return {
    title: q === null ? t("title") : t("titleWithQuery", { q }),
    description: t("description"),
    robots: { index: false, follow: true },
  };
}

export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<SearchResultsSkeleton />}>
      <SearchResults searchParams={searchParams} />
    </Suspense>
  );
}

/** The results for the current `q`: the count, the grid, the pagination — or the prompt or the empty state. */
async function SearchResults({ searchParams }: { searchParams: SearchParams }) {
  const [t, search] = await Promise.all([getTranslations("search"), searchParams]);
  const { q, after, before } = parseSearchPageParams(search);

  if (q === null) return <SearchPrompt title={t("promptTitle")} body={t("promptBody")} />;

  const listing = await searchProducts(q, after, before);
  const count = listing.totalCount ?? listing.items.length;
  const query = encodeURIComponent(q);
  const previousHref =
    listing.pageInfo.hasPreviousPage && listing.pageInfo.startCursor !== null
      ? `/search?q=${query}&before=${encodeURIComponent(listing.pageInfo.startCursor)}`
      : null;
  const nextHref =
    listing.pageInfo.hasNextPage && listing.pageInfo.endCursor !== null
      ? `/search?q=${query}&after=${encodeURIComponent(listing.pageInfo.endCursor)}`
      : null;

  if (listing.items.length === 0) {
    return (
      <SearchEmpty
        title={t("noResultsTitle", { q })}
        body={t("noResultsBody")}
        browseAll={t("browseAll")}
      />
    );
  }

  return (
    <>
      <div className="container-content pt-8">
        <h1 className="text-balance text-h1">{t("resultsFor", { q })}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("resultCount", { count })}</p>
      </div>
      <div className="w-full">
        <div className="container-content py-8">
          <ProductGrid items={listing.items} addAction={addToCart} />
          <Pagination previousHref={previousHref} nextHref={nextHref} />
        </div>
      </div>
    </>
  );
}

/** The icon-and-copy block the prompt and the "no results" state share. */
function SearchMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto max-w-md">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <SearchIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-balance text-h1">{title}</h1>
        <p className="mt-2 text-pretty text-lead text-muted-foreground">{body}</p>
        {children !== undefined && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}

/** No `q`: the search prompt; the header's form (or any other one) starts the search. */
function SearchPrompt({ title, body }: { title: string; body: string }) {
  return <SearchMessage title={title} body={body} />;
}

/** A `q` with no matches: the message plus a link to browse everything (Paper's empty state). */
function SearchEmpty({
  title,
  body,
  browseAll,
}: {
  title: string;
  body: string;
  browseAll: string;
}) {
  return (
    <SearchMessage title={title} body={body}>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/products"
          className={buttonClassName({ asLink: true, className: "rounded-lg px-6 py-3" })}
        >
          {browseAll}
        </Link>
      </div>
    </SearchMessage>
  );
}

/** The results island's placeholder: a heading and a page of pulsing cards. */
function SearchResultsSkeleton() {
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
