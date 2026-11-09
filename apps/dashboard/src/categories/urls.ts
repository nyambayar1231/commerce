// Adapted from saleor-dashboard: src/categories/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list's state lives in the URL as Saleor's: `query` (search), `sort` + `asc`, the page cursor
// (`after` / `before`) and the open dialog (`action`). Saleor's saved filter presets (`activeTab`)
// and bulk-selection `ids` are not here yet.

export const categorySectionUrl = "/categories/";
export const categoryListPath = categorySectionUrl;

export type CategoryListUrlDialog = "delete" | "create";

export const CategoryListUrlSortField = {
  name: "name",
  productCount: "products",
  subcategoryCount: "subcategories",
} as const;

export type CategoryListUrlSortField =
  (typeof CategoryListUrlSortField)[keyof typeof CategoryListUrlSortField];

export interface CategoryListUrlQueryParams {
  action?: CategoryListUrlDialog;
  query?: string;
  sort?: CategoryListUrlSortField;
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

export const categoryListUrl = (params?: CategoryListUrlQueryParams): string =>
  `${categorySectionUrl}?${query({ ...params })}`;

const SORT_FIELDS = Object.values(CategoryListUrlSortField) as string[];
const DIALOGS: CategoryListUrlDialog[] = ["delete", "create"];

/** The list's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parseCategoryListUrl = (search: URLSearchParams): CategoryListUrlQueryParams => {
  const params: CategoryListUrlQueryParams = {};
  const action = search.get("action");
  const sort = search.get("sort");
  const asc = search.get("asc");

  if (action && (DIALOGS as string[]).includes(action))
    params.action = action as CategoryListUrlDialog;
  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (sort && SORT_FIELDS.includes(sort)) params.sort = sort as CategoryListUrlSortField;
  if (asc === "true" || asc === "false") params.asc = asc === "true";
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  return params;
};

export const categoryPath = (id: string): string => `${categorySectionUrl}${id}`;

export type CategoryUrlDialog = "delete" | "delete-categories" | "create";

export interface CategoryUrlQueryParams {
  action?: CategoryUrlDialog;
}

export const categoryUrl = (id: string, params?: CategoryUrlQueryParams): string =>
  `${categoryPath(encodeURIComponent(id))}?${query({ ...params })}`;
