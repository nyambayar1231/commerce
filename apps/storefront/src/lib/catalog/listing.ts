import "server-only";

import { connection } from "next/server";
import type { ProductListingQueryVariables, ProductOrder, ProductWhereInput } from "@/gql/graphql";
import { FilterOptionsDocument, ProductListingDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import { getCategoryCached } from "./categories";
import { getCollectionCached } from "./collections";
import { toFilterOptions, toListing } from "./mappers";
import type {
  FilterOptionsView,
  ListingParams,
  ListingScope,
  ListingSort,
  ListingView,
} from "./types";

// The listing pages' data (ARCHITECTURE §10.7). The public loaders follow the M4.1b pattern:
// `await connection()` — no API call at build time — then a `"use cache"` inner with only
// normalized, serializable arguments, tagged for the later on-demand revalidation.

/** One page of a listing. */
export const LISTING_PAGE_SIZE = 24;

const SORT_INPUT: Record<ListingSort, ProductOrder> = {
  newest: { field: "CREATED_AT", direction: "DESC" },
  "price-asc": { field: "PRICE", direction: "ASC" },
  "price-desc": { field: "PRICE", direction: "DESC" },
  "name-asc": { field: "NAME", direction: "ASC" },
};

/** The GraphQL `sortBy` of a listing's sort. */
export function sortInput(sort: ListingSort): ProductOrder {
  return SORT_INPUT[sort];
}

/** A listing's filters with the filter slugs already resolved to global ids. */
export type ListingFilters = {
  scope: ListingScope;
  /** The `?category=` filter's id, or null when the slug is unknown (the filter is ignored). */
  categoryId: string | null;
  collectionId: string | null;
  minPrice?: number;
  maxPrice?: number;
};

/**
 * The GraphQL `where` of a listing, or undefined when nothing filters it. The route's own
 * category/collection is the page's identity and wins over the same-kind URL filter (whose
 * select that page hides anyway). Sold-out products are shown, not filtered out.
 */
export function listingWhereInput(filters: ListingFilters): ProductWhereInput | undefined {
  const where: ProductWhereInput = {};
  if (filters.scope.kind === "category") where.category = { eq: filters.scope.id };
  else if (filters.categoryId !== null) where.category = { eq: filters.categoryId };

  if (filters.scope.kind === "collection") where.collection = { eq: filters.scope.id };
  else if (filters.collectionId !== null) where.collection = { eq: filters.collectionId };

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.minimalPrice = { range: { gte: filters.minPrice, lte: filters.maxPrice } };
  }

  return Object.keys(where).length === 0 ? undefined : where;
}

type ResolvedListingArgs = ListingFilters & {
  sort: ListingSort;
  after?: string;
  before?: string;
};

async function getProductListingCached(args: ResolvedListingArgs): Promise<ListingView> {
  "use cache";
  const where = listingWhereInput(args);
  const variables: ProductListingQueryVariables = {
    sortBy: sortInput(args.sort),
    ...(args.after !== undefined
      ? { first: LISTING_PAGE_SIZE, after: args.after }
      : args.before !== undefined
        ? { last: LISTING_PAGE_SIZE, before: args.before }
        : { first: LISTING_PAGE_SIZE }),
    ...(where !== undefined ? { where } : {}),
  };
  const data = await cachedQuery(ProductListingDocument, {
    variables,
    tags: [
      tags.products,
      ...(args.scope.kind === "category" ? [tags.category(args.scope.slug)] : []),
      ...(args.scope.kind === "collection" ? [tags.collection(args.scope.slug)] : []),
    ],
  });
  if (data.products === null) throw new Error("ProductListing returned no connection");
  return toListing(data.products);
}

/**
 * One page of a listing, normalized from the page's scope and URL params. A filter slug is
 * resolved to an id through the cached slug loaders before the cached query, so an unknown
 * slug is simply ignored; unknown route slugs never reach this function (the page `notFound()`s).
 */
export async function getProductListing(
  scope: ListingScope,
  params: ListingParams,
): Promise<ListingView> {
  await connection();
  const [category, collection] = await Promise.all([
    params.category !== undefined ? getCategoryCached(params.category) : null,
    params.collection !== undefined ? getCollectionCached(params.collection) : null,
  ]);
  return getProductListingCached({
    scope,
    sort: params.sort,
    categoryId: category?.id ?? null,
    collectionId: collection?.id ?? null,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    after: params.after,
    before: params.before,
  });
}

async function getFilterOptionsCached(): Promise<FilterOptionsView> {
  "use cache";
  // The option lists change on the same staff catalog edits as the products tag; there is no
  // categories-list tag in `tags` yet (ARCHITECTURE §10.7).
  const data = await cachedQuery(FilterOptionsDocument, { tags: [tags.products] });
  return toFilterOptions(data);
}

/** The filter bar's option lists: every category (indentation is by level) and collection. */
export async function getFilterOptions(): Promise<FilterOptionsView> {
  await connection();
  return getFilterOptionsCached();
}
