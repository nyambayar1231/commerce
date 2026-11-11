// Adapted from saleor-dashboard: src/orders/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's OrderList query, limited to the fields our single-channel list shows: no channel,
// delivery method or subtotal (the Net, Delivery and Channel columns are not built).
import { gql } from "@apollo/client";

import { pageInfoFragment } from "../fragments/pageInfo";

export const orderList = gql`
  query OrderList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $where: OrderWhereInput
    $search: String
    $sort: OrderSortingInput
  ) {
    orders(
      before: $before
      after: $after
      first: $first
      last: $last
      where: $where
      search: $search
      sortBy: $sort
    ) {
      edges {
        node {
          id
          number
          created
          status
          userEmail
          billingAddress {
            firstName
            lastName
          }
          total {
            gross {
              amount
              currency
            }
          }
          chargeStatus
          authorizeStatus
          totalCharged {
            amount
          }
          totalChargePending {
            amount
          }
          totalRefunded {
            amount
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
