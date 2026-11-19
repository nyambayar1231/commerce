// Adapted from saleor-dashboard: src/collections/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's collection list query, limited to our single channel: its `channel` argument and
// channel listings are gone, so the list shows the collection's own publication state. The row
// carries what the grid's three columns show.
import { gql } from "@apollo/client";

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
