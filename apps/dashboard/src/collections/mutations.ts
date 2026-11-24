// Adapted from saleor-dashboard: src/collections/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's mutations for the list and the detail page. The collection's reorder mutation is left
// out (the API has no manual product order, so the products card has no drag-to-reorder); Saleor's
// assign mutation pairs collectionAddProducts with collectionReorderProducts as a workaround, which
// we don't need.
import { gql } from "@apollo/client";

import { collectionDetailsFragment } from "../fragments/collections";

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

export const collectionUpdate = gql`
  mutation CollectionUpdate($id: ID!, $input: CollectionInput!) {
    collectionUpdate(id: $id, input: $input) {
      collection {
        ...CollectionDetails
      }
      errors {
        ...CollectionError
      }
    }
  }
  ${collectionDetailsFragment}
  ${collectionErrorFragment}
`;

export const removeCollection = gql`
  mutation RemoveCollection($id: ID!) {
    collectionDelete(id: $id) {
      errors {
        ...CollectionError
      }
    }
  }
  ${collectionErrorFragment}
`;

export const collectionAssignProduct = gql`
  mutation CollectionAssignProduct($collectionId: ID!, $products: [ID!]!) {
    collectionAddProducts(collectionId: $collectionId, products: $products) {
      errors {
        ...CollectionError
      }
    }
  }
  ${collectionErrorFragment}
`;

export const unassignCollectionProduct = gql`
  mutation UnassignCollectionProduct($collectionId: ID!, $products: [ID!]!) {
    collectionRemoveProducts(collectionId: $collectionId, products: $products) {
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
