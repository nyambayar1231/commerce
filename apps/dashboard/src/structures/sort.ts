// Adapted from saleor-dashboard: src/structures/views/MenuList/sort.ts and src/utils/sort.ts's
// createGetSortQueryVariables (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's two sortable columns: the structure title and the number of items. Sorting always
// tie-breaks by id on the API.
import type { MenuSortField, OrderDirection } from "../graphql/types.generated";
import { type MenuListUrlQueryParams, MenuListUrlSortField } from "./urls";

function getSortQueryField(sort: MenuListUrlQueryParams["sort"]): MenuSortField | undefined {
  switch (sort) {
    case MenuListUrlSortField.name:
      return "NAME";
    case MenuListUrlSortField.items:
      return "ITEMS_COUNT";
    default:
      return undefined;
  }
}

export const getSortQueryVariables = (
  params: MenuListUrlQueryParams,
): { direction: OrderDirection; field: MenuSortField } | undefined => {
  const field = getSortQueryField(params.sort);

  return field ? { direction: params.asc === false ? "DESC" : "ASC", field } : undefined;
};

/** Saleor's createSortHandler: the same column flips the direction, another one sorts ascending. */
export const getSortUrlParams = (
  params: MenuListUrlQueryParams,
  field: MenuListUrlQueryParams["sort"],
): MenuListUrlQueryParams => ({
  ...params,
  after: undefined,
  before: undefined,
  sort: field,
  asc: params.sort === field ? !params.asc : true,
});
