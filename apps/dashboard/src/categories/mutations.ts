// Adapted from saleor-dashboard: src/categories/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { gql } from "@apollo/client";

import { categoryDetailsFragment } from "../fragments/categories";
import { productErrorFragment } from "../fragments/errors";

export const categoryDeleteMutation = gql`
  mutation CategoryDelete($id: ID!) {
    categoryDelete(id: $id) {
      errors {
        ...ProductError
      }
    }
  }
  ${productErrorFragment}
`;

export const categoryCreateMutation = gql`
  mutation CategoryCreate($parent: ID, $input: CategoryInput!) {
    categoryCreate(parent: $parent, input: $input) {
      category {
        ...CategoryDetails
      }
      errors {
        ...ProductError
      }
    }
  }
  ${categoryDetailsFragment}
  ${productErrorFragment}
`;

export const categoryUpdateMutation = gql`
  mutation CategoryUpdate($id: ID!, $input: CategoryInput!) {
    categoryUpdate(id: $id, input: $input) {
      category {
        ...CategoryDetails
      }
      errors {
        ...ProductError
      }
    }
  }
  ${categoryDetailsFragment}
  ${productErrorFragment}
`;

export const categoryBulkDeleteMutation = gql`
  mutation CategoryBulkDelete($ids: [ID!]!) {
    categoryBulkDelete(ids: $ids) {
      errors {
        ...ProductError
      }
    }
  }
  ${productErrorFragment}
`;
