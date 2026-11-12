// Adapted from saleor-dashboard: src/customers/urls.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The customer list's state lives in the URL as Saleor's: `query` (search), `sort` + `asc` and
// the page cursor. Without a sort param the list sorts by name, ascending (Saleor's asSortParams
// default). Not yet: the conditional filters, customer-type tabs and the list dialogs.

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

export interface CustomerListUrlQueryParams {
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
    asc: asc === "false" ? false : true,
  };

  if (search.get("query")) params.query = search.get("query") ?? undefined;
  if (search.get("after")) params.after = search.get("after") ?? undefined;
  else if (search.get("before")) params.before = search.get("before") ?? undefined;

  return params;
};

export const customerPath = (id: string): string => `${customerSection}/${id}`;

export const customerUrl = (id: string): string => customerPath(encodeURIComponent(id));
