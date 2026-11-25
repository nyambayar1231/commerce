import "server-only";

import { ProductSearchDocument } from "@/gql/graphql";
import { sessionQuery } from "@/lib/api";
import type { RawSearchParams } from "@/lib/catalog/listing-params";
import { toListing } from "@/lib/catalog/mappers";
import type { ListingView } from "@/lib/catalog/types";

// Product search (ARCHITECTURE §10.7): `sessionQuery`, uncached, because arbitrary search text
// would fill the shared cache. The query handling is pure and unit-tested; the URL state is
// parsed here so the page's island stays thin.

/** The search box's `maxLength`, and the cut applied to a submitted `q`. */
export const SEARCH_QUERY_MAX = 100;

/** One page of search results (the listing page size, ARCHITECTURE §10.7). */
export const SEARCH_PAGE_SIZE = 24;

const MAX_CURSOR = 200;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCursor(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 && value.length <= MAX_CURSOR ? value : undefined;
}

/**
 * The `q` of a search: the first value, trimmed and cut to 100 characters. Whitespace-only,
 * empty or absent `q` is `null` — no API call, the page shows the prompt instead.
 */
export function parseSearchQuery(value: string | string[] | undefined): string | null {
  const q = firstValue(value)?.trim().slice(0, SEARCH_QUERY_MAX);
  return q !== undefined && q.length > 0 ? q : null;
}

/** A search page's URL state: `q` plus at most one cursor direction (`after` wins). */
export function parseSearchPageParams(searchParams: RawSearchParams): {
  q: string | null;
  after?: string;
  before?: string;
} {
  const after = parseCursor(firstValue(searchParams.after));
  return {
    q: parseSearchQuery(searchParams.q),
    ...(after !== undefined ? { after } : { before: parseCursor(firstValue(searchParams.before)) }),
  };
}

/**
 * One page of search results for a non-empty `q`. Uncached (`sessionQuery`), so an API failure
 * throws (the route's Mongolian error boundary) rather than being shown as "no results".
 */
export async function searchProducts(
  q: string,
  after?: string,
  before?: string,
): Promise<ListingView> {
  const variables = {
    q,
    ...(before !== undefined
      ? { last: SEARCH_PAGE_SIZE, before }
      : { first: SEARCH_PAGE_SIZE, ...(after !== undefined ? { after } : {}) }),
  };
  const result = await sessionQuery(ProductSearchDocument, { variables });
  if (!result.ok) throw result.error;
  if (result.data.products === null) throw new Error("ProductSearch returned no connection");
  return toListing(result.data.products);
}
