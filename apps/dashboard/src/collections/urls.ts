// Adapted from saleor-dashboard: src/collections/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list's state lives in the URL as Saleor's: `query` (search), the `status` filter
// (published / hidden), `sort` + `asc`, the page cursor (`after` / `before`) and the open dialog
// (`action`). Saleor's saved filter presets (`activeTab`), its `channel` filter and the legacy
// `/collections/add` path are not here. Saleor serialises the bulk-selection `ids` with qs
// (`ids[0]=…`); we have no qs, so they are comma-separated here.
export const collectionSectionUrl = "/collections/";
export const collectionListPath = collectionSectionUrl;

export type CollectionListUrlDialog = "create" | "remove";

export const CollectionListUrlSortField = {
  name: "name",
  productCount: "productCount",
  availability: "availability",
} as const;

export type CollectionListUrlSortField =
  (typeof CollectionListUrlSortField)[keyof typeof CollectionListUrlSortField];

/** The publication filter's values, as the URL spells them. */
export type CollectionListUrlStatus = "published" | "hidden";

export interface CollectionListUrlQueryParams {
  action?: CollectionListUrlDialog;
  /** The rows the open dialog acts on (Saleor's BulkAction). */
  ids?: string[];
  query?: string;
  status?: CollectionListUrlStatus;
  sort?: CollectionListUrlSortField;
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

export const collectionListUrl = (params?: CollectionListUrlQueryParams): string =>
  `${collectionSectionUrl}?${query({ ...params })}`;

const SORT_FIELDS = Object.values(CollectionListUrlSortField) as string[];
const DIALOGS: CollectionListUrlDialog[] = ["create", "remove"];
const STATUSES: CollectionListUrlStatus[] = ["published", "hidden"];

/** The list's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parseCollectionListUrl = (search: URLSearchParams): CollectionListUrlQueryParams => {
  const params: CollectionListUrlQueryParams = {};
  const action = search.get("action");
  const sort = search.get("sort");
  const asc = search.get("asc");
  const status = search.get("status");
  const ids = search.get("ids");

  if (action && (DIALOGS as string[]).includes(action)) {
    params.action = action as CollectionListUrlDialog;
  }
  if (ids) params.ids = ids.split(",").filter(Boolean);
  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (status && (STATUSES as string[]).includes(status)) {
    params.status = status as CollectionListUrlStatus;
  }
  if (sort && SORT_FIELDS.includes(sort)) params.sort = sort as CollectionListUrlSortField;
  if (asc === "true" || asc === "false") params.asc = asc === "true";
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  return params;
};

export const collectionPath = (id: string): string => `${collectionSectionUrl}${id}`;

// Saleor's CollectionUrlDialog for the detail page: delete the collection, assign products from the
// picker, or unassign the selected rows.
export type CollectionUrlDialog = "assign" | "remove" | "unassign";

export interface CollectionUrlQueryParams {
  action?: CollectionUrlDialog;
  /** The rows the unassign dialog acts on (Saleor's `ids`). */
  ids?: string[];
}

export const collectionUrl = (id: string, params?: CollectionUrlQueryParams): string =>
  `${collectionPath(encodeURIComponent(id))}?${query({ ...params })}`;

const DETAIL_DIALOGS: CollectionUrlDialog[] = ["assign", "remove", "unassign"];

/** The detail page's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parseCollectionUrl = (search: URLSearchParams): CollectionUrlQueryParams => {
  const params: CollectionUrlQueryParams = {};
  const action = search.get("action");
  const ids = search.get("ids");

  if (action && (DETAIL_DIALOGS as string[]).includes(action)) {
    params.action = action as CollectionUrlDialog;
  }
  if (ids) params.ids = ids.split(",").filter(Boolean);

  return params;
};
