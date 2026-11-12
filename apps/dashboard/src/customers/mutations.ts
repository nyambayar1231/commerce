// Adapted from saleor-dashboard: src/customers/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's customer mutations without the address ones (no address book: PLAN M7 decision 4).
import { gql } from "@apollo/client";

import { accountErrorFragment } from "../fragments/errors";
import { customerDetailsFragment } from "./queries";

export const updateCustomer = gql`
  ${accountErrorFragment}
  ${customerDetailsFragment}
  mutation UpdateCustomer($id: ID!, $input: CustomerInput!) {
    customerUpdate(id: $id, input: $input) {
      errors {
        ...AccountError
      }
      user {
        ...CustomerDetails
      }
    }
  }
`;

export const createCustomer = gql`
  ${accountErrorFragment}
  mutation CreateCustomer($input: UserCreateInput!) {
    customerCreate(input: $input) {
      errors {
        ...AccountError
      }
      user {
        id
      }
    }
  }
`;

export const removeCustomer = gql`
  ${accountErrorFragment}
  mutation RemoveCustomer($id: ID!) {
    customerDelete(id: $id) {
      errors {
        ...AccountError
      }
    }
  }
`;

export const bulkRemoveCustomers = gql`
  ${accountErrorFragment}
  mutation BulkRemoveCustomers($ids: [ID!]!) {
    customerBulkDelete(ids: $ids) {
      errors {
        ...AccountError
      }
    }
  }
`;
