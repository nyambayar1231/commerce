// Adapted from saleor-dashboard: src/products/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's product list and detail queries, limited to our single channel and the fields the
// list and the update page show: search, sort, where filters and cursor pagination. The category
// search feeds the update page's category picker (Saleor's src/searches/useCategorySearch.ts).
import { gql } from "@apollo/client";

import { pageInfoFragment } from "../fragments/pageInfo";
import { productDetailsFragment, productListRowFragment } from "../fragments/products";

export const productList = gql`
  query ProductList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $search: String
    $sort: ProductOrder
    $where: ProductWhereInput
  ) {
    products(
      first: $first
      after: $after
      last: $last
      before: $before
      search: $search
      sortBy: $sort
      where: $where
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

export const productDetails = gql`
  query ProductDetails($id: ID!) {
    product(id: $id) {
      ...ProductDetails
    }
  }
  ${productDetailsFragment}
`;

export const categorySearch = gql`
  query SearchCategories($first: Int!, $after: String, $filter: CategoryFilterInput) {
    search: categories(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          name
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${pageInfoFragment}
`;
