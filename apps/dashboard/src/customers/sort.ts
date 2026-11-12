// Adapted from saleor-dashboard: src/customers/views/CustomerList/sort.ts and src/utils/sort.ts
// createGetSortQueryVariables (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor sorts the name column by last name, as here.
import type { OrderDirection, UserSortField } from "../graphql/types.generated";
import { type CustomerListUrlQueryParams, CustomerListUrlSortField } from "./urls";

function getSortQueryField(sort: CustomerListUrlQueryParams["sort"]): UserSortField | undefined {
  switch (sort) {
    case CustomerListUrlSortField.email:
      return "EMAIL";
    case CustomerListUrlSortField.name:
      return "LAST_NAME";
    case CustomerListUrlSortField.orders:
      return "ORDER_COUNT";
    default:
      return undefined;
  }
}

export const getSortQueryVariables = (
  params: CustomerListUrlQueryParams,
): { direction: OrderDirection; field: UserSortField } | undefined => {
  const field = getSortQueryField(params.sort);

  return field ? { direction: params.asc === false ? "DESC" : "ASC", field } : undefined;
};

/** Saleor's canBeSorted: only columns backed by a UserSortField sort the list. */
export const canBeSorted = (columnId: string | undefined): columnId is CustomerListUrlSortField =>
  getSortQueryField(columnId as CustomerListUrlQueryParams["sort"]) !== undefined;

/** Saleor's createSortHandler: the same column flips the direction, another one sorts ascending. */
export const getSortUrlParams = (
  params: CustomerListUrlQueryParams,
  field: CustomerListUrlSortField,
): CustomerListUrlQueryParams => ({
  ...params,
  after: undefined,
  before: undefined,
  sort: field,
  asc: params.sort === field ? !params.asc : true,
});
