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

// Saleor's CustomerDetails fragment without the address book, note, isConfirmed, external
// reference, customer type and attributes (PLAN M7 decisions 3–4).
export const customerDetailsFragment = gql`
  ${customerFragment}
  fragment CustomerDetails on User {
    ...Customer
    dateJoined
    lastLogin
    isActive
    isStaff
  }
`;

// Saleor's CustomerDetails query: the recent orders, the KPI window (the last 50 orders) and the
// count of orders that are not cancelled, all only for staff who may read orders. Without
// channels there is no channel argument; ours keeps the statuses our orders can have.
export const customerDetails = gql`
  ${customerDetailsFragment}
  query CustomerDetails($id: ID!, $PERMISSION_MANAGE_ORDERS: Boolean!) {
    user(id: $id) {
      ...CustomerDetails
      orders(first: 10) @include(if: $PERMISSION_MANAGE_ORDERS) {
        totalCount
        edges {
          node {
            id
            created
            number
            status
            total {
              gross {
                currency
                amount
              }
            }
          }
        }
      }
      kpiOrders: orders(first: 50) @include(if: $PERMISSION_MANAGE_ORDERS) {
        edges {
          node {
            id
            status
            created
            subtotal {
              net {
                amount
                currency
              }
            }
            shippingPrice {
              gross {
                amount
                currency
              }
            }
            totalRefunded {
              amount
              currency
            }
          }
        }
      }
      kpiNonCancelledOrderCount: orders(
        first: 1
        where: { status: { oneOf: [UNFULFILLED, PARTIALLY_FULFILLED, FULFILLED] } }
      ) @include(if: $PERMISSION_MANAGE_ORDERS) {
        totalCount
      }
    }
  }
`;
