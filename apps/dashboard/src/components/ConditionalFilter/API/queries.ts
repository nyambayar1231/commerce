// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/queries.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The two category queries the filter panel needs: one page of options for the picker, and the
// URL's selected IDs for their names. Saleor's other operands (collections, product types,
// customers, attributes, channels, pages, warehouses…) are dropped with their handlers.
import { gql } from "@apollo/client";

export const initialCategoryOperands = gql`
  query _SearchCategoriesOperands($first: Int!, $ids: [ID!]) {
    categories(first: $first, filter: { ids: $ids }) {
      edges {
        node {
          id
          name
          slug
        }
      }
    }
  }
`;

export const categoryChoicesQueries = gql`
  query _GetCategoriesChoices($first: Int!, $query: String!, $after: String) {
    categories(first: $first, after: $after, filter: { search: $query }) {
      edges {
        node {
          id
          name
          slug
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
