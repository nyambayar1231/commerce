// Adapted from saleor-dashboard: src/modeling/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's mutations for the list and the detail page, minus the bulk publish/unpublish mutations
// (the API has none) and the metadata mutations (not in this step).
import { gql } from "@apollo/client";

import { pageDetailsFragment } from "../fragments/pages";

export const pageErrorFragment = gql`
  fragment PageError on PageError {
    code
    field
    message
  }
`;

export const createPage = gql`
  mutation CreatePage($input: PageCreateInput!) {
    pageCreate(input: $input) {
      page {
        id
      }
      errors {
        ...PageError
      }
    }
  }
  ${pageErrorFragment}
`;

export const pageUpdate = gql`
  mutation PageUpdate($id: ID!, $input: PageInput!) {
    pageUpdate(id: $id, input: $input) {
      page {
        ...PageDetails
      }
      errors {
        ...PageError
      }
    }
  }
  ${pageDetailsFragment}
  ${pageErrorFragment}
`;

export const removePage = gql`
  mutation RemovePage($id: ID!) {
    pageDelete(id: $id) {
      errors {
        ...PageError
      }
    }
  }
  ${pageErrorFragment}
`;

export const pageBulkDelete = gql`
  mutation PageBulkDelete($ids: [ID!]!) {
    pageBulkDelete(ids: $ids) {
      count
      errors {
        ...PageError
      }
    }
  }
  ${pageErrorFragment}
`;
