// Adapted from saleor-dashboard: src/modeling/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's model list and details queries, limited to our fields: no page-type filter or tabs, no
// attribute values, no metadata. The row carries what the grid's three columns show.
import { gql } from "@apollo/client";
import { pageInfoFragment } from "../fragments/pageInfo";
import { pageDetailsFragment } from "../fragments/pages";

export const pageListRowFragment = gql`
  fragment PageListRow on Page {
    id
    title
    slug
    isPublished
    publishedAt
  }
`;

export const pageList = gql`
  query PageList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filter: PageFilterInput
    $sort: PageSortingInput
  ) {
    pages(
      first: $first
      after: $after
      last: $last
      before: $before
      filter: $filter
      sortBy: $sort
    ) {
      edges {
        node {
          ...PageListRow
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${pageListRowFragment}
  ${pageInfoFragment}
`;

export const pageDetails = gql`
  query PageDetails($id: ID!) {
    page(id: $id) {
      ...PageDetails
    }
  }
  ${pageDetailsFragment}
`;
