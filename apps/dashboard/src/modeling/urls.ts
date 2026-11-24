// Adapted from saleor-dashboard: src/modeling/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list's state lives in the URL as Saleor's: `query` (search), `sort` + `asc`, the page cursor
// (`after` / `before`) and the open dialog (`action`). Saleor's page-type filter (`pageTypes`), its
// saved filter presets, the "content type" sort column and the page-type picker on create are not
// here: we have no page types (M15.7a). The bulk-selection `ids` are comma-separated, as the
// collection list's.
export const modelingSectionUrl = "/models/";
export const pageListPath = modelingSectionUrl;

export type PageListUrlDialog = "remove";

export const PageListUrlSortField = {
  title: "title",
  slug: "slug",
  visible: "visible",
} as const;

export type PageListUrlSortField = (typeof PageListUrlSortField)[keyof typeof PageListUrlSortField];

export interface PageListUrlQueryParams {
  action?: PageListUrlDialog;
  /** The rows the open dialog acts on (Saleor's BulkAction). */
  ids?: string[];
  query?: string;
  sort?: PageListUrlSortField;
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

export const pageListUrl = (params?: PageListUrlQueryParams): string =>
  `${modelingSectionUrl}?${query({ ...params })}`;

const SORT_FIELDS = Object.values(PageListUrlSortField) as string[];
const DIALOGS: PageListUrlDialog[] = ["remove"];

/** The list's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parsePageListUrl = (search: URLSearchParams): PageListUrlQueryParams => {
  const params: PageListUrlQueryParams = {};
  const action = search.get("action");
  const sort = search.get("sort");
  const asc = search.get("asc");
  const ids = search.get("ids");

  if (action && (DIALOGS as string[]).includes(action)) {
    params.action = action as PageListUrlDialog;
  }
  if (ids) params.ids = ids.split(",").filter(Boolean);
  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (sort && SORT_FIELDS.includes(sort)) params.sort = sort as PageListUrlSortField;
  if (asc === "true" || asc === "false") params.asc = asc === "true";
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  return params;
};

export const pagePath = (id: string): string => `${modelingSectionUrl}${id}`;

// Saleor's PageUrlDialog for the detail page, minus the metadata dialog and the attribute-value
// picker we don't have.
export type PageUrlDialog = "remove";

export interface PageUrlQueryParams {
  action?: PageUrlDialog;
}

export const pageUrl = (id: string, params?: PageUrlQueryParams): string =>
  `${pagePath(encodeURIComponent(id))}?${query({ ...params })}`;

const DETAIL_DIALOGS: PageUrlDialog[] = ["remove"];

/** The detail page's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parsePageUrl = (search: URLSearchParams): PageUrlQueryParams => {
  const params: PageUrlQueryParams = {};
  const action = search.get("action");

  if (action && (DETAIL_DIALOGS as string[]).includes(action)) {
    params.action = action as PageUrlDialog;
  }

  return params;
};

// Saleor's pageCreatePath (`/models/add`). Its page-type query param is not here: Create goes
// straight to the empty details screen.
export const pageCreatePath = `${modelingSectionUrl}add`;
