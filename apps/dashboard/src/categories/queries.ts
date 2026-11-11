// Adapted from saleor-dashboard: src/categories/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's queries. The card's product row fields are Saleor's CollectionProduct fragment, limited
// to what we show: name, thumbnail and single-channel availability.
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
  query CategoryDetails(
    $id: ID!
    $childrenFirst: Int
    $childrenAfter: String
    $childrenLast: Int
    $childrenBefore: String
  ) {
    category(id: $id) {
      ...CategoryDetails
      children(
        first: $childrenFirst
        after: $childrenAfter
        last: $childrenLast
        before: $childrenBefore
      ) {
        totalCount
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
  ${categoryDetailsFragment}
  ${categoryFragment}
  ${pageInfoFragment}
`;

export const categoryProducts = gql`
  query CategoryProducts($id: ID!, $first: Int, $after: String, $last: Int, $before: String) {
    category(id: $id) {
      id
      products(first: $first, after: $after, before: $before, last: $last) {
        edges {
          node {
            id
            name
            isPublished
            publishedAt
            thumbnail {
              url
            }
          }
        }
        pageInfo {
          ...PageInfo
        }
      }
    }
  }
  ${pageInfoFragment}
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
