// Adapted from saleor-dashboard: src/collections/views/CollectionList/sort.ts and
// src/utils/sort.ts createGetSortQueryVariables (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor allows the availability sort only with a channel selected, because it sorts channel
// listings. We have one channel, so all three columns sort.
import type { CollectionSortField, OrderDirection } from "../graphql/types.generated";
import { type CollectionListUrlQueryParams, CollectionListUrlSortField } from "./urls";

function getSortQueryField(
  sort: CollectionListUrlQueryParams["sort"],
): CollectionSortField | undefined {
  switch (sort) {
    case CollectionListUrlSortField.name:
      return "NAME";
    case CollectionListUrlSortField.productCount:
      return "PRODUCT_COUNT";
    case CollectionListUrlSortField.availability:
      return "AVAILABILITY";
    default:
      return undefined;
  }
}

export const getSortQueryVariables = (
  params: CollectionListUrlQueryParams,
): { direction: OrderDirection; field: CollectionSortField } | undefined => {
  const field = getSortQueryField(params.sort);

  return field ? { direction: params.asc === false ? "DESC" : "ASC", field } : undefined;
};

/** Saleor's createSortHandler: the same column flips the direction, another one sorts ascending. */
export const getSortUrlParams = (
  params: CollectionListUrlQueryParams,
  field: CollectionListUrlQueryParams["sort"],
): CollectionListUrlQueryParams => ({
  ...params,
  after: undefined,
  before: undefined,
  sort: field,
  asc: params.sort === field ? !params.asc : true,
});
