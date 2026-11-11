// Adapted from saleor-dashboard: src/fragments/orders.ts, src/fragments/address.ts and
// src/fragments/transactions.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order detail page's fragments, limited to the fields our API has and the read-only cards
// show: no channel, discounts, gift cards, invoices, fulfillments (M6.4), payments (legacy API),
// metadata or actions. A line's thumbnail comes from its variant's product (Saleor: line.thumbnail).
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
    user {
      id
      email
      firstName
      lastName
    }
  }
`;

export const orderDetailsFragment = gql`
  fragment OrderDetails on Order {
    id
    number
    created
    status
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
