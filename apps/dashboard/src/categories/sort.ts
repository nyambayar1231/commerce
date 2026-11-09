// Adapted from saleor-dashboard: src/categories/views/CategoryList/sort.ts and
// src/utils/sort.ts createGetSortQueryVariables (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { CategorySortField, OrderDirection } from "../graphql/types.generated";
import { type CategoryListUrlQueryParams, CategoryListUrlSortField } from "./urls";

// PRODUCT_COUNT arrives with products (M2.2); until then the products column isn't shown.
function getSortQueryField(
  sort: CategoryListUrlQueryParams["sort"],
): CategorySortField | undefined {
  switch (sort) {
    case CategoryListUrlSortField.name:
      return "NAME";
    case CategoryListUrlSortField.subcategoryCount:
      return "SUBCATEGORY_COUNT";
    default:
      return undefined;
  }
}

export const getSortQueryVariables = (
  params: CategoryListUrlQueryParams,
): { direction: OrderDirection; field: CategorySortField } | undefined => {
  const field = getSortQueryField(params.sort);

  return field ? { direction: params.asc === false ? "DESC" : "ASC", field } : undefined;
};

/** Saleor's createSortHandler: the same column flips the direction, another one sorts ascending. */
export const getSortUrlParams = (
  params: CategoryListUrlQueryParams,
  field: CategoryListUrlQueryParams["sort"],
): CategoryListUrlQueryParams => ({
  ...params,
  after: undefined,
  before: undefined,
  sort: field,
  asc: params.sort === field ? !params.asc : true,
});
