// Adapted from saleor-dashboard: src/categories/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's CategoryDetails query without children/products pagination (M2.1.6 / M2.2).
import { gql } from "@apollo/client";

import { categoryDetailsFragment, categoryFragment } from "../fragments/categories";
import { pageInfoFragment } from "../fragments/pageInfo";

export const rootCategories = gql`
  query RootCategories(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filter: CategoryFilterInput
    $sort: CategorySortingInput
  ) {
    categories(
      level: 0
      first: $first
      after: $after
      last: $last
      before: $before
      filter: $filter
      sortBy: $sort
    ) {
      edges {
        node {
          ...Category
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${categoryFragment}
  ${pageInfoFragment}
`;

export const categoryDetailsQuery = gql`
  query CategoryDetails($id: ID!) {
    category(id: $id) {
      ...CategoryDetails
    }
  }
  ${categoryDetailsFragment}
`;

export const categoryChildren = gql`
  query CategoryChildren($id: ID!, $first: Int!, $after: String) {
    category(id: $id) {
      id
      children(first: $first, after: $after) {
        edges {
          node {
            ...Category
          }
        }
        pageInfo {
          ...PageInfo
        }
      }
    }
  }
  ${categoryFragment}
  ${pageInfoFragment}
`;
