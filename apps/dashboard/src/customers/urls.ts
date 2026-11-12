// Adapted from saleor-dashboard: src/customers/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The customer list's state lives in the URL as Saleor's: `query` (search), `sort` + `asc`, the
// page cursor and the open dialog (`action=remove`, the bulk delete). Without a sort param the
// list sorts by name, ascending (Saleor's asSortParams default). The customer page keeps its open
// dialog there too (`action=remove|activate|deactivate`). Left out: the conditional filters,
// customer-type tabs and their dialogs.

const customerSection = "/customers";

export const customerListPath = customerSection;

// Saleor's CustomerListUrlSortField.
export const CustomerListUrlSortField = {
  name: "name",
  email: "email",
  orders: "orders",
} as const;

export type CustomerListUrlSortField =
  (typeof CustomerListUrlSortField)[keyof typeof CustomerListUrlSortField];

export type CustomerListUrlDialog = "remove";

export interface CustomerListUrlQueryParams {
  action?: CustomerListUrlDialog;
  query?: string;
  sort?: CustomerListUrlSortField;
  asc?: boolean;
  after?: string;
  before?: string;
}

const queryEntries = (params: Record<string, string | boolean | undefined>): [string, string][] =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => [key, String(value)]);

export const customerListUrl = (params?: CustomerListUrlQueryParams): string => {
  const query = new URLSearchParams(queryEntries({ ...params })).toString();

  return query ? `${customerListPath}?${query}` : customerListPath;
};

const SORT_FIELDS = Object.values(CustomerListUrlSortField) as string[];

/** The list's URL params with Saleor's defaults (name, ascending); invalid values are ignored. */
export const parseCustomerListUrl = (search: URLSearchParams): CustomerListUrlQueryParams => {
  const sort = search.get("sort");
  const asc = search.get("asc");
  const params: CustomerListUrlQueryParams = {
    sort:
      sort && SORT_FIELDS.includes(sort)
        ? (sort as CustomerListUrlSortField)
        : CustomerListUrlSortField.name,
    asc: asc !== "false",
  };

  if (search.get("action") === "remove") params.action = "remove";
  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  return params;
};

export const customerPath = (id: string): string => `${customerSection}/${id}`;

// Saleor's CustomerUrlDialog, without the metadata and attribute dialogs.
export type CustomerUrlDialog = "remove" | "activate" | "deactivate";

export interface CustomerUrlQueryParams {
  action?: CustomerUrlDialog;
}

const CUSTOMER_DIALOGS: CustomerUrlDialog[] = ["remove", "activate", "deactivate"];

export const customerUrl = (id: string, params?: CustomerUrlQueryParams): string => {
  const query = new URLSearchParams(queryEntries({ ...params })).toString();

  return `${customerPath(encodeURIComponent(id))}${query ? `?${query}` : ""}`;
};

export const parseCustomerUrl = (search: URLSearchParams): CustomerUrlQueryParams => {
  const action = search.get("action");

  return {
    action:
      action && (CUSTOMER_DIALOGS as string[]).includes(action)
        ? (action as CustomerUrlDialog)
        : undefined,
  };
};

export const customerAddPath = `${customerSection}/add`;

export const customerAddUrl = (): string => customerAddPath;
