// Adapted from saleor-dashboard: src/categories/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the dialog param so far; sort, search, pagination and bulk params come with the list (M2.1.8).

export const categorySectionUrl = "/categories/";
export const categoryListPath = categorySectionUrl;

export type CategoryListUrlDialog = "delete" | "create";

export interface CategoryListUrlQueryParams {
  action?: CategoryListUrlDialog;
}

const query = (params?: Record<string, string | undefined>): string => {
  const entries = Object.entries(params ?? {}).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return new URLSearchParams(entries).toString();
};

export const categoryListUrl = (params?: CategoryListUrlQueryParams): string =>
  `${categorySectionUrl}?${query({ ...params })}`;

export const categoryPath = (id: string): string => `${categorySectionUrl}${id}`;

export type CategoryUrlDialog = "delete" | "create";

export interface CategoryUrlQueryParams {
  action?: CategoryUrlDialog;
}

export const categoryUrl = (id: string, params?: CategoryUrlQueryParams): string =>
  `${categoryPath(encodeURIComponent(id))}?${query({ ...params })}`;
