// Adapted from saleor-dashboard: src/customers/queries.ts and src/fragments/customers.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ListCustomers query without `where`, `externalReference` and the default billing
// address (no filters, external references or address book: PLAN M7 decisions 3–4). The order
// count is asked only of staff who may read orders, as in Saleor.
import { gql } from "@apollo/client";

import { pageInfoFragment } from "../fragments/pageInfo";

export const customerFragment = gql`
  fragment Customer on User {
    id
    email
    firstName
    lastName
  }
`;

export const customerList = gql`
  ${customerFragment}
  ${pageInfoFragment}
  query ListCustomers(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $search: String
    $sort: UserSortingInput
    $PERMISSION_MANAGE_ORDERS: Boolean!
  ) {
    customers(
      after: $after
      before: $before
      first: $first
      last: $last
      search: $search
      sortBy: $sort
    ) {
      edges {
        node {
          ...Customer
          orders @include(if: $PERMISSION_MANAGE_ORDERS) {
            totalCount
          }
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
`;
