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

export const orderUrl = (id: string): string => orderPath(encodeURIComponent(id));
