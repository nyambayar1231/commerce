// Adapted from saleor-dashboard: src/fragments/orders.ts, src/fragments/address.ts and
// src/fragments/transactions.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order detail page's fragments, limited to the fields our API has and the cards show: no
// channel, discounts, gift cards, invoices, payments (legacy API) or metadata. A line's thumbnail
// comes from its variant's product (Saleor: line.thumbnail). M6.5 adds fulfillments, the order's
// and transactions' actions and the event details the history shows.
import { gql } from "@apollo/client";

export const addressFragment = gql`
  fragment Address on Address {
    city
    cityArea
    companyName
    country {
      code
      country
    }
    countryArea
    firstName
    lastName
    phone
    postalCode
    streetAddress1
    streetAddress2
  }
`;

export const orderLineFragment = gql`
  fragment OrderLine on OrderLine {
    id
    productName
    productSku
    variantName
    quantity
    quantityFulfilled
    quantityToFulfill
    unitPrice {
      gross {
        amount
        currency
      }
    }
    totalPrice {
      gross {
        amount
        currency
      }
    }
    variant {
      id
      product {
        id
        thumbnail {
          url
        }
      }
    }
  }
`;

export const transactionEventFragment = gql`
  fragment TransactionEvent on TransactionEvent {
    id
    pspReference
    amount {
      amount
      currency
    }
    type
    message
    createdAt
    externalUrl
  }
`;

export const transactionItemFragment = gql`
  fragment TransactionItem on TransactionItem {
    id
    actions
    name
    pspReference
    externalUrl
    createdAt
    events {
      ...TransactionEvent
    }
    authorizedAmount {
      amount
      currency
    }
    chargedAmount {
      amount
      currency
    }
    refundedAmount {
      amount
      currency
    }
    canceledAmount {
      amount
      currency
    }
    authorizePendingAmount {
      amount
      currency
    }
    chargePendingAmount {
      amount
      currency
    }
    refundPendingAmount {
      amount
      currency
    }
    cancelPendingAmount {
      amount
      currency
    }
  }
`;

export const orderEventFragment = gql`
  fragment OrderEvent on OrderEvent {
    id
    date
    type
    amount
    transactionReference
    fulfilledItems {
      id
      quantity
      orderLine {
        id
        productName
        variantName
      }
    }
    user {
      id
      email
      firstName
      lastName
    }
  }
`;

export const fulfillmentFragment = gql`
  fragment Fulfillment on Fulfillment {
    id
    fulfillmentOrder
    status
    created
    warehouse {
      id
      name
    }
    lines {
      id
      quantity
      orderLine {
        ...OrderLine
      }
    }
  }
`;

export const orderDetailsFragment = gql`
  fragment OrderDetails on Order {
    id
    number
    created
    status
    actions
    userEmail
    shippingMethodName
    billingAddress {
      ...Address
    }
    shippingAddress {
      ...Address
    }
    lines {
      ...OrderLine
    }
    fulfillments {
      ...Fulfillment
    }
    subtotal {
      gross {
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
    total {
      gross {
        amount
        currency
      }
      tax {
        amount
        currency
      }
    }
    chargeStatus
    authorizeStatus
    totalAuthorized {
      amount
      currency
    }
    totalCharged {
      amount
      currency
    }
    totalBalance {
      amount
      currency
    }
    transactions {
      ...TransactionItem
    }
    events {
      ...OrderEvent
    }
  }
`;
