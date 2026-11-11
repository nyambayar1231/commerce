// Adapted from saleor-dashboard: src/orders/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order actions of PLAN M6.5: fulfill, cancel, mark as paid, and a transaction refund. Each
// returns the order's details so the page updates from Apollo's cache.
import { gql } from "@apollo/client";

import {
  addressFragment,
  fulfillmentFragment,
  orderDetailsFragment,
  orderEventFragment,
  orderLineFragment,
  transactionEventFragment,
  transactionItemFragment,
} from "../fragments/orders";

const orderDetailsFragments = `
  ${orderDetailsFragment}
  ${addressFragment}
  ${orderLineFragment}
  ${fulfillmentFragment}
  ${transactionItemFragment}
  ${transactionEventFragment}
  ${orderEventFragment}
`;

export const orderErrorFragment = gql`
  fragment OrderError on OrderError {
    code
    field
    message
    orderLines
    warehouse
  }
`;

export const fulfillOrder = gql`
  mutation FulfillOrder($orderId: ID!, $input: OrderFulfillInput!) {
    orderFulfill(order: $orderId, input: $input) {
      errors {
        ...OrderError
      }
      order {
        ...OrderDetails
      }
    }
  }
  ${orderErrorFragment}
  ${orderDetailsFragments}
`;

export const orderCancel = gql`
  mutation OrderCancel($id: ID!) {
    orderCancel(id: $id) {
      errors {
        ...OrderError
      }
      order {
        ...OrderDetails
      }
    }
  }
  ${orderErrorFragment}
  ${orderDetailsFragments}
`;

export const orderMarkAsPaid = gql`
  mutation OrderMarkAsPaid($id: ID!, $transactionReference: String) {
    orderMarkAsPaid(id: $id, transactionReference: $transactionReference) {
      errors {
        ...OrderError
      }
      order {
        ...OrderDetails
      }
    }
  }
  ${orderErrorFragment}
  ${orderDetailsFragments}
`;

// Saleor's OrderTransactionRequestAction, with the amount our refund dialog asks for.
export const orderTransactionRefund = gql`
  mutation OrderTransactionRefund($transactionId: ID!, $amount: Decimal) {
    transactionRequestAction(id: $transactionId, actionType: REFUND, amount: $amount) {
      errors {
        field
        code
        message
      }
      transaction {
        ...TransactionItem
        order {
          id
          chargeStatus
          authorizeStatus
          actions
          totalCharged {
            amount
            currency
          }
          totalBalance {
            amount
            currency
          }
          events {
            ...OrderEvent
          }
        }
      }
    }
  }
  ${transactionItemFragment}
  ${transactionEventFragment}
  ${orderEventFragment}
`;
