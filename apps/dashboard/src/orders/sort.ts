// Adapted from saleor-dashboard: src/orders/views/OrderList/sort.ts and src/utils/sort.ts
// createGetSortQueryVariables (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor sorts the date column by the deprecated CREATION_DATE; we send its replacement CREATED_AT.
import type { OrderDirection, OrderSortField } from "../graphql/types.generated";
import { type OrderListUrlQueryParams, OrderListUrlSortField } from "./urls";

export const DEFAULT_SORT_KEY = OrderListUrlSortField.number;

function getSortQueryField(sort: OrderListUrlQueryParams["sort"]): OrderSortField | undefined {
  switch (sort) {
    case OrderListUrlSortField.number:
      return "NUMBER";
    case OrderListUrlSortField.date:
      return "CREATED_AT";
    case OrderListUrlSortField.customer:
      return "CUSTOMER";
    case OrderListUrlSortField.fulfillment:
      return "FULFILLMENT_STATUS";
    case OrderListUrlSortField.payment:
      return "PAYMENT";
    default:
      return undefined;
  }
}

export const getSortQueryVariables = (
  params: OrderListUrlQueryParams,
): { direction: OrderDirection; field: OrderSortField } | undefined => {
  const field = getSortQueryField(params.sort);

  return field ? { direction: params.asc === false ? "DESC" : "ASC", field } : undefined;
};

/** Saleor's createSortHandler: the same column flips the direction, another one sorts ascending. */
export const getSortUrlParams = (
  params: OrderListUrlQueryParams,
  field: OrderListUrlSortField,
): OrderListUrlQueryParams => ({
  ...params,
  after: undefined,
  before: undefined,
  sort: field,
  asc: params.sort === field ? !params.asc : true,
});
