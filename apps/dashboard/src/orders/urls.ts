// Adapted from saleor-dashboard: src/orders/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order list's state lives in the URL as Saleor's: the conditional filters (indexed
// `0[s2.status]=…` entries), `query` (search), `sort` + `asc` and the page cursor. Not yet: draft
// orders, saved filter presets, dialogs and the customer-filter helpers.
import type { FilterContainer } from "../components/ConditionalFilter/FilterElement/FilterElement";
import {
  filterQueryEntries,
  parseFilterContainer,
} from "../components/ConditionalFilter/ValueProvider/TokenArray";
import { prepareStructure } from "../components/ConditionalFilter/ValueProvider/utils";

const orderSectionUrl = "/orders";

export const orderListPath = orderSectionUrl;

// Saleor's OrderListUrlSortField, minus `total` and `rank` (not sortable in our API: total has no
// sort field, and search keeps the chosen sort instead of switching to rank).
export const OrderListUrlSortField = {
  number: "number",
  customer: "customer",
  date: "date",
  fulfillment: "status",
  payment: "payment",
} as const;

export type OrderListUrlSortField =
  (typeof OrderListUrlSortField)[keyof typeof OrderListUrlSortField];

export interface OrderListUrlQueryParams {
  query?: string;
  sort?: OrderListUrlSortField;
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

export const orderListUrl = (params?: OrderListUrlQueryParams): string => {
  const { filters, ...rest } = params ?? {};
  const entries = [...(filters ? filterUrlEntries(filters) : []), ...queryEntries({ ...rest })];

  return `${orderListPath}?${new URLSearchParams(entries).toString()}`;
};

const SORT_FIELDS = Object.values(OrderListUrlSortField) as string[];

/** The list's URL params, ignoring values that aren't valid (a hand-edited URL). */
export const parseOrderListUrl = (search: URLSearchParams): OrderListUrlQueryParams => {
  const params: OrderListUrlQueryParams = {};
  const sort = search.get("sort");
  const asc = search.get("asc");

  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (sort && SORT_FIELDS.includes(sort)) params.sort = sort as OrderListUrlSortField;
  if (asc === "true" || asc === "false") params.asc = asc === "true";
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  const filters = parseFilterContainer(search.toString());

  if (filters.some((entry) => typeof entry !== "string")) {
    params.filters = filters;
  }

  return params;
};

export const orderPath = (id: string): string => `${orderSectionUrl}/${id}`;

// Saleor's OrderUrlDialog, limited to our actions: the open dialog lives in the URL (`action`), and
// a transaction dialog names its transaction (`id`). Saleor refunds through a separate page; our
// refund is a dialog on the transaction tile (PLAN M6 decision 1).
export type OrderUrlDialog = "cancel" | "mark-paid" | "refund";

export interface OrderUrlQueryParams {
  action?: OrderUrlDialog;
  id?: string;
}

const ORDER_DIALOGS: OrderUrlDialog[] = ["cancel", "mark-paid", "refund"];

export const orderUrl = (id: string, params?: OrderUrlQueryParams): string => {
  const query = new URLSearchParams(queryEntries({ ...params })).toString();

  return `${orderPath(encodeURIComponent(id))}${query ? `?${query}` : ""}`;
};

export const parseOrderUrl = (search: URLSearchParams): OrderUrlQueryParams => {
  const action = search.get("action");

  return {
    action:
      action && (ORDER_DIALOGS as string[]).includes(action)
        ? (action as OrderUrlDialog)
        : undefined,
    id: search.get("id") ?? undefined,
  };
};

// Saleor's /orders/:id/fulfill.
export const orderFulfillPath = (id: string): string => `${orderPath(id)}/fulfill`;

export const orderFulfillUrl = (id: string): string => orderFulfillPath(encodeURIComponent(id));

// Saleor's draft order URLs: the list at /orders/drafts (sort, search and page in the URL as the
// order list; no filters or presets yet) and a draft at /orders/drafts/:id.
export const orderDraftListPath = `${orderSectionUrl}/drafts`;

export const OrderDraftListUrlSortField = {
  number: "number",
  date: "date",
  customer: "customer",
  total: "total",
} as const;

export type OrderDraftListUrlSortField =
  (typeof OrderDraftListUrlSortField)[keyof typeof OrderDraftListUrlSortField];

export interface OrderDraftListUrlQueryParams {
  query?: string;
  sort?: OrderDraftListUrlSortField;
  asc?: boolean;
  after?: string;
  before?: string;
}

export const orderDraftListUrl = (params?: OrderDraftListUrlQueryParams): string => {
  const query = new URLSearchParams(queryEntries({ ...params })).toString();

  return `${orderDraftListPath}${query ? `?${query}` : ""}`;
};

const DRAFT_SORT_FIELDS = Object.values(OrderDraftListUrlSortField) as string[];

export const parseOrderDraftListUrl = (search: URLSearchParams): OrderDraftListUrlQueryParams => {
  const params: OrderDraftListUrlQueryParams = {};
  const sort = search.get("sort");
  const asc = search.get("asc");

  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (sort && DRAFT_SORT_FIELDS.includes(sort)) params.sort = sort as OrderDraftListUrlSortField;
  if (asc === "true" || asc === "false") params.asc = asc === "true";
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  return params;
};

export const orderDraftPath = (id: string): string => `${orderDraftListPath}/${id}`;

export const orderDraftUrl = (id: string): string => orderDraftPath(encodeURIComponent(id));
