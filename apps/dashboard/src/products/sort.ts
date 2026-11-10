// Adapted from saleor-dashboard: src/products/views/ProductList/sort.ts and
// src/utils/sort.ts createGetSortQueryVariables (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { OrderDirection, ProductOrderField } from "../graphql/types.generated";
import { type ProductListUrlQueryParams, ProductListUrlSortField } from "./urls";

function getSortQueryField(sort: ProductListUrlQueryParams["sort"]): ProductOrderField | undefined {
  switch (sort) {
    case ProductListUrlSortField.name:
      return "NAME";
    case ProductListUrlSortField.availability:
      return "PUBLISHED";
    case ProductListUrlSortField.price:
      return "PRICE";
    case ProductListUrlSortField.date:
      return "LAST_MODIFIED_AT";
    case ProductListUrlSortField.created:
      return "CREATED_AT";
    default:
      return undefined;
  }
}

export const getSortQueryVariables = (
  params: ProductListUrlQueryParams,
): { direction: OrderDirection; field: ProductOrderField } | undefined => {
  const field = getSortQueryField(params.sort);

  return field ? { direction: params.asc === false ? "DESC" : "ASC", field } : undefined;
};

/** Saleor's createSortHandler: the same column flips the direction, another one sorts ascending. */
export const getSortUrlParams = (
  params: ProductListUrlQueryParams,
  field: ProductListUrlQueryParams["sort"],
): ProductListUrlQueryParams => ({
  ...params,
  after: undefined,
  before: undefined,
  sort: field,
  asc: params.sort === field ? !params.asc : true,
});
