// Adapted from saleor-dashboard: src/products/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's product list query, limited to our single channel and the fields the list shows:
// search, sort and cursor pagination.
import { gql } from "@apollo/client";

import { pageInfoFragment } from "../fragments/pageInfo";
import { productListRowFragment } from "../fragments/products";

export const productList = gql`
  query ProductList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $search: String
    $sort: ProductOrder
  ) {
    products(
      first: $first
      after: $after
      last: $last
      before: $before
      search: $search
      sortBy: $sort
    ) {
      edges {
        node {
          ...ProductListRow
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${productListRowFragment}
  ${pageInfoFragment}
`;
