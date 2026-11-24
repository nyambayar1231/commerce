// Adapted from saleor-dashboard: src/collections/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's collection list, detail and products queries, limited to our single channel: its
// `channel` argument and channel listings are gone, so the list shows the collection's own
// publication state. The row carries what the grid's three columns show. The detail page's products
// card pages its own connection (as the category page's); the assign-product picker searches the
// catalogue (`products(search)`) and asks each match for its collections to keep the ones already
// assigned out of reach.
import { gql } from "@apollo/client";

import { collectionDetailsFragment, collectionProductFragment } from "../fragments/collections";
import { pageInfoFragment } from "../fragments/pageInfo";

export const collectionListRowFragment = gql`
  fragment CollectionListRow on Collection {
    id
    name
    isPublished
    publishedAt
    products {
      totalCount
    }
  }
`;

export const collectionList = gql`
  query CollectionList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filter: CollectionFilterInput
    $sort: CollectionSortingInput
  ) {
    collections(
      first: $first
      after: $after
      last: $last
      before: $before
      filter: $filter
      sortBy: $sort
    ) {
      edges {
        node {
          ...CollectionListRow
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${collectionListRowFragment}
  ${pageInfoFragment}
`;

export const collectionDetails = gql`
  query CollectionDetails($id: ID!) {
    collection(id: $id) {
      ...CollectionDetails
    }
  }
  ${collectionDetailsFragment}
`;

export const collectionProducts = gql`
  query CollectionProducts($id: ID!, $first: Int, $after: String, $last: Int, $before: String) {
    collection(id: $id) {
      id
      products(first: $first, after: $after, before: $before, last: $last) {
        totalCount
        edges {
          node {
            ...CollectionProduct
          }
        }
        pageInfo {
          ...PageInfo
        }
      }
    }
  }
  ${collectionProductFragment}
  ${pageInfoFragment}
`;

// Saleor's AssignProductDialog search (src/searches/useProductSearch): the picker's first page.
// `collections` tells the picker which matches are already in the open collection.
export const collectionAssignProductSearch = gql`
  query CollectionAssignProductSearch($first: Int, $search: String) {
    products(first: $first, search: $search) {
      edges {
        node {
          id
          name
          thumbnail {
            url
          }
          collections {
            id
          }
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${pageInfoFragment}
`;
