import type { ListingParams, ListingSort, PageInfoView } from "./types";

// The listing pages' URL state (ARCHITECTURE §10.7): search params are parsed and normalized here,
// and every listing URL (filter form targets, pagination links, "clear filters") is built here.
// Pure and unit-tested; the islands in `src/app` call these, then hand view models to `src/ui`.

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 255;
const MAX_PRICE = 1_000_000_000;
const MAX_CURSOR = 200;

export const LISTING_SORTS: readonly ListingSort[] = [
  "newest",
  "price-asc",
  "price-desc",
  "name-asc",
];

/** What Next.js hands a page as `searchParams` (also what a GET form submits). */
export type RawSearchParams = Record<string, string | string[] | undefined>;

type RawValue = string | string[] | undefined;

/** Repeated params use the first value. */
function firstValue(value: RawValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Whole numbers ≥ 0 up to a billion; anything else (empty, signed, decimal) is dropped. */
function parsePrice(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const price = Number(value);
  return price <= MAX_PRICE ? price : undefined;
}

function parseSlug(value: string | undefined): string | undefined {
  return value !== undefined && value.length <= MAX_SLUG && SLUG_PATTERN.test(value)
    ? value
    : undefined;
}

function parseCursor(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 && value.length <= MAX_CURSOR ? value : undefined;
}

/**
 * Parses and normalizes a listing page's `searchParams`. Unknown sort → `newest`; invalid prices,
 * slugs and cursors are dropped; a min above max is swapped; `after` wins over `before`.
 */
export function parseListingParams(searchParams: RawSearchParams): ListingParams {
  const sortValue = firstValue(searchParams.sort);
  const sort: ListingSort =
    sortValue !== undefined && LISTING_SORTS.includes(sortValue as ListingSort)
      ? (sortValue as ListingSort)
      : "newest";

  const parsedMin = parsePrice(firstValue(searchParams.minPrice));
  const parsedMax = parsePrice(firstValue(searchParams.maxPrice));
  const [minPrice, maxPrice] =
    parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax
      ? [parsedMax, parsedMin]
      : [parsedMin, parsedMax];

  const after = parseCursor(firstValue(searchParams.after));
  const before = after === undefined ? parseCursor(firstValue(searchParams.before)) : undefined;
  const category = parseSlug(firstValue(searchParams.category));
  const collection = parseSlug(firstValue(searchParams.collection));

  return {
    sort,
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(collection !== undefined ? { collection } : {}),
    ...(after !== undefined ? { after } : {}),
    ...(before !== undefined ? { before } : {}),
  };
}

/** What `listingSearchParams` accepts: a present `undefined` removes the param. */
export type ListingParamOverrides = {
  sort?: ListingSort | undefined;
  category?: string | undefined;
  collection?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
};

/**
 * Builds a listing URL's query string (no leading `?`; empty for the plain listing). Changing a
 * filter or the sort restarts the list at the first page, so it drops the cursors; a cursor
 * override replaces the other one. The default sort is omitted to keep URLs canonical.
 */
export function listingSearchParams(
  params: ListingParams,
  overrides: ListingParamOverrides = {},
): string {
  const sort = overrides.sort !== undefined ? overrides.sort : params.sort;
  // `key in overrides` tells "remove" (present, undefined) apart from "keep" (absent).
  const category = "category" in overrides ? overrides.category : params.category;
  const collection = "collection" in overrides ? overrides.collection : params.collection;
  const minPrice = "minPrice" in overrides ? overrides.minPrice : params.minPrice;
  const maxPrice = "maxPrice" in overrides ? overrides.maxPrice : params.maxPrice;

  const pageChanged = Object.keys(overrides).some((key) => key !== "after" && key !== "before");
  // A cursor override replaces the other one: a page only ever has one cursor direction.
  const after =
    pageChanged || "before" in overrides
      ? undefined
      : "after" in overrides
        ? overrides.after
        : params.after;
  const before =
    pageChanged || "after" in overrides
      ? undefined
      : "before" in overrides
        ? overrides.before
        : params.before;

  const search = new URLSearchParams();
  if (sort !== "newest") search.set("sort", sort);
  if (category !== undefined) search.set("category", category);
  if (collection !== undefined) search.set("collection", collection);
  if (minPrice !== undefined) search.set("minPrice", String(minPrice));
  if (maxPrice !== undefined) search.set("maxPrice", String(maxPrice));
  if (after !== undefined) search.set("after", after);
  if (before !== undefined) search.set("before", before);
  return search.toString();
}

/** `basePath` plus a query string, if any. */
export function listingHref(
  basePath: string,
  params: ListingParams,
  overrides: ListingParamOverrides = {},
): string {
  const query = listingSearchParams(params, overrides);
  return query === "" ? basePath : `${basePath}?${query}`;
}

/**
 * The previous/next page links of a listing: `?before=<startCursor>` / `?after=<endCursor>`
 * with the filters and sort kept. `null` is a direction with no page behind it.
 */
export function paginationHrefs(
  basePath: string,
  params: ListingParams,
  pageInfo: PageInfoView,
): { previousHref: string | null; nextHref: string | null } {
  return {
    previousHref:
      pageInfo.hasPreviousPage && pageInfo.startCursor !== null
        ? listingHref(basePath, params, { before: pageInfo.startCursor })
        : null,
    nextHref:
      pageInfo.hasNextPage && pageInfo.endCursor !== null
        ? listingHref(basePath, params, { after: pageInfo.endCursor })
        : null,
  };
}
