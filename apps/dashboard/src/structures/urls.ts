// Adapted from saleor-dashboard: src/structures/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's structures URLs: the list at `/structures/` and a menu at `/structures/:id`. The list's
// state lives in the URL as Saleor's: `query` (search), `sort` + `asc`, the page cursor
// (`after` / `before`) and the open dialog (`action`, with the row it acts on in `id` or the
// selection in `ids`). The menu's dialogs are `add-item`, `edit-item` (the item in `id`) and
// `remove`.
export const structuresSectionUrl = "/structures/";
export const structuresListPath = structuresSectionUrl;

export type MenuListUrlDialog = "add" | "remove" | "remove-many";

export const MenuListUrlSortField = {
  name: "name",
  items: "items",
} as const;

export type MenuListUrlSortField = (typeof MenuListUrlSortField)[keyof typeof MenuListUrlSortField];

export interface MenuListUrlQueryParams {
  action?: MenuListUrlDialog;
  /** The row a single-row dialog acts on (Saleor's SingleAction). */
  id?: string;
  /** The rows the open dialog acts on (Saleor's BulkAction). */
  ids?: string[];
  query?: string;
  sort?: MenuListUrlSortField;
  asc?: boolean;
  after?: string;
  before?: string;
}

type QueryEntry = [string, string];

const query = (params?: Record<string, string | boolean | string[] | undefined>): string => {
  const entries = Object.entries(params ?? {}).flatMap(([key, value]): QueryEntry[] => {
    if (value === undefined || value === "") return [];
    if (Array.isArray(value)) return value.length > 0 ? [[key, value.join(",")]] : [];

    return [[key, String(value)]];
  });

  return new URLSearchParams(entries).toString();
};

export const menuListUrl = (params?: MenuListUrlQueryParams): string =>
  `${structuresSectionUrl}?${query({ ...params })}`;

const SORT_FIELDS = Object.values(MenuListUrlSortField) as string[];
const DIALOGS: MenuListUrlDialog[] = ["add", "remove", "remove-many"];

/** The list's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parseMenuListUrl = (search: URLSearchParams): MenuListUrlQueryParams => {
  const params: MenuListUrlQueryParams = {};
  const action = search.get("action");
  const sort = search.get("sort");
  const asc = search.get("asc");
  const ids = search.get("ids");

  if (action && (DIALOGS as string[]).includes(action)) {
    params.action = action as MenuListUrlDialog;
  }
  if (search.get("id")) params.id = search.get("id") ?? undefined;
  if (ids) params.ids = ids.split(",").filter(Boolean);
  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (sort && SORT_FIELDS.includes(sort)) params.sort = sort as MenuListUrlSortField;
  if (asc === "true" || asc === "false") params.asc = asc === "true";
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  return params;
};

export const menuPath = (id: string): string => `${structuresSectionUrl}${id}`;

// Saleor's MenuUrlDialog, minus the metadata and translation dialogs.
export type MenuUrlDialog = "add-item" | "edit-item" | "remove";

export interface MenuUrlQueryParams {
  action?: MenuUrlDialog;
  /** The item `edit-item` opens. */
  id?: string;
}

export const menuUrl = (id: string, params?: MenuUrlQueryParams): string =>
  `${menuPath(encodeURIComponent(id))}?${query({ ...params })}`;

const DETAIL_DIALOGS: MenuUrlDialog[] = ["add-item", "edit-item", "remove"];

/** The menu's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parseMenuUrl = (search: URLSearchParams): MenuUrlQueryParams => {
  const params: MenuUrlQueryParams = {};
  const action = search.get("action");

  if (action && (DETAIL_DIALOGS as string[]).includes(action)) {
    params.action = action as MenuUrlDialog;
  }
  if (search.get("id")) params.id = search.get("id") ?? undefined;

  return params;
};
