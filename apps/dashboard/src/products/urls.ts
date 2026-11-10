// Adapted from saleor-dashboard: src/products/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's state lives in the URL as Saleor's: `query` (search), `sort` + `asc` and the
// page cursor (`after` / `before`). Not yet: Saleor's saved filter presets, filters, bulk-selection
// `ids` and the dialogs (M2.3/M2.4).

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
}

const query = (params?: Record<string, string | boolean | undefined>): string => {
  const entries = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => [key, String(value)]);
  return new URLSearchParams(entries).toString();
};

export const productListUrl = (params?: ProductListUrlQueryParams): string =>
  `${productSectionUrl}?${query({ ...params })}`;

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

  return params;
};

export const productPath = (id: string): string => `${productSectionUrl}${id}`;

export const productUrl = (id: string): string => `${productPath(encodeURIComponent(id))}?`;
