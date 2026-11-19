// Adapted from saleor-dashboard: src/collections/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The create and bulk-delete mutations the list needs; the detail page's update/assign/remove
// mutations come with it (M15.5b).
import { gql } from "@apollo/client";

export const collectionErrorFragment = gql`
  fragment CollectionError on CollectionError {
    code
    field
    message
  }
`;

export const createCollection = gql`
  mutation CreateCollection($input: CollectionCreateInput!) {
    collectionCreate(input: $input) {
      collection {
        id
      }
      errors {
        ...CollectionError
      }
    }
  }
  ${collectionErrorFragment}
`;

export const collectionBulkDelete = gql`
  mutation CollectionBulkDelete($ids: [ID!]!) {
    collectionBulkDelete(ids: $ids) {
      count
      errors {
        ...CollectionError
      }
    }
  }
  ${collectionErrorFragment}
`;
