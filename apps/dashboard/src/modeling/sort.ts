// Adapted from saleor-dashboard: src/modeling/views/PageList/sort.ts and src/utils/sort.ts's
// createGetSortQueryVariables (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor sorts models by title, slug and visibility; its "content type" column has no
// PageSortField, so it is not a column here either (no page types).
import type { OrderDirection, PageSortField } from "../graphql/types.generated";
import { type PageListUrlQueryParams, PageListUrlSortField } from "./urls";

function getSortQueryField(sort: PageListUrlQueryParams["sort"]): PageSortField | undefined {
  switch (sort) {
    case PageListUrlSortField.title:
      return "TITLE";
    case PageListUrlSortField.slug:
      return "SLUG";
    case PageListUrlSortField.visible:
      return "VISIBILITY";
    default:
      return undefined;
  }
}

export const getSortQueryVariables = (
  params: PageListUrlQueryParams,
): { direction: OrderDirection; field: PageSortField } | undefined => {
  const field = getSortQueryField(params.sort);

  return field ? { direction: params.asc === false ? "DESC" : "ASC", field } : undefined;
};

/** Saleor's createSortHandler: the same column flips the direction, another one sorts ascending. */
export const getSortUrlParams = (
  params: PageListUrlQueryParams,
  field: PageListUrlQueryParams["sort"],
): PageListUrlQueryParams => ({
  ...params,
  after: undefined,
  before: undefined,
  sort: field,
  asc: params.sort === field ? !params.asc : true,
});
