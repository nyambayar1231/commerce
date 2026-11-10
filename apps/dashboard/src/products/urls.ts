// Adapted from saleor-dashboard: src/products/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's state lives in the URL as Saleor's: the conditional filters (indexed
// `0[s0.isPublished]=false` entries), `query` (search), `sort` + `asc` and the page cursor
// (`after` / `before`). Not yet: Saleor's saved filter presets, bulk-selection `ids` and dialogs.
import type { FilterContainer } from "../components/ConditionalFilter/FilterElement/FilterElement";
import {
  filterQueryEntries,
  parseFilterContainer,
} from "../components/ConditionalFilter/ValueProvider/TokenArray";
import { prepareStructure } from "../components/ConditionalFilter/ValueProvider/utils";

export const productSectionUrl = "/products/";
export const productListPath = productSectionUrl;

// Saleor's ProductListUrlSortField, minus the fields we can't fill yet: `productType`,
// `attribute` and `rank`. `productCategory` is not sortable (Saleor's isn't either).
export const ProductListUrlSortField = {
  name: "name",
  availability: "availability",
  price: "price",
  date: "date",
  created: "created",
} as const;

export type ProductListUrlSortField =
  (typeof ProductListUrlSortField)[keyof typeof ProductListUrlSortField];

export interface ProductListUrlQueryParams {
  query?: string;
  sort?: ProductListUrlSortField;
  asc?: boolean;
  after?: string;
  before?: string;
  filters?: FilterContainer;
}

type QueryEntry = [string, string];

const queryEntries = (params: Record<string, string | boolean | undefined>): QueryEntry[] =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => [key, String(value)]);

/** The filter entries alone, as query-string entries: pagination keeps them in its links. */
export const filterUrlEntries = (filters: FilterContainer): QueryEntry[] =>
  filterQueryEntries(prepareStructure(filters));

export const productListUrl = (params?: ProductListUrlQueryParams): string => {
  const { filters, ...rest } = params ?? {};
  const entries = [...(filters ? filterUrlEntries(filters) : []), ...queryEntries({ ...rest })];

  return `${productSectionUrl}?${new URLSearchParams(entries).toString()}`;
};

const SORT_FIELDS = Object.values(ProductListUrlSortField) as string[];

/** The list's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parseProductListUrl = (search: URLSearchParams): ProductListUrlQueryParams => {
  const params: ProductListUrlQueryParams = {};
  const sort = search.get("sort");
  const asc = search.get("asc");

  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (sort && SORT_FIELDS.includes(sort)) params.sort = sort as ProductListUrlSortField;
  if (asc === "true" || asc === "false") params.asc = asc === "true";
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  const filters = parseFilterContainer(search.toString());

  if (filters.some((entry) => typeof entry !== "string")) {
    params.filters = filters;
  }

  return params;
};

/** Changing filters, like search and sort, starts again from the first page. */
export const getFiltersUrlParams = (
  params: ProductListUrlQueryParams,
  filters: FilterContainer,
): ProductListUrlQueryParams => ({ ...params, after: undefined, before: undefined, filters });

export const productPath = (id: string): string => `${productSectionUrl}${id}`;

export const productUrl = (id: string): string => `${productPath(encodeURIComponent(id))}?`;
