// Adapted from saleor-dashboard: src/orders/components/OrderTransaction/components/CardTitle/messages.ts,
// TransactionEvents/messages.ts and src/orders/messages.ts transactionEventTypeMap
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessages } from "react-intl";

export const amountMessages = defineMessages({
  cancelPending: {
    defaultMessage: "Pending cancel",
    id: "YUaalK",
    description: "Cancel in progress transaction amount, data display header",
  },
  canceled: {
    defaultMessage: "Canceled",
    id: "phIGQ1",
    description: "Canceled transaction amount, data display header",
  },
  refundPending: {
    defaultMessage: "Pending refund",
    id: "nSMe3f",
    description: "Refund in progress transaction amount, data display header",
  },
  refunded: {
    defaultMessage: "Refunded",
    id: "gNm1li",
    description: "Refunded transaction amount, data display header",
  },
  chargePending: {
    defaultMessage: "Pending charge",
    id: "4fJ17F",
    description: "Charge in progress transaction amount, data display header",
  },
  charged: {
    defaultMessage: "Charged",
    id: "LY5dS9",
    description: "Charged transaction amount, data display header",
  },
  authorizePending: {
    defaultMessage: "Pending auth",
    id: "9WhNiN",
    description: "Pending authorization transaction amount, data display header",
  },
  authorized: {
    defaultMessage: "Authorized",
    id: "7ejEbB",
    description:
      "Authorized (amount locked on card, not transfered to store owner) transaction amount, data display header",
  },
});

export const statusMessages = defineMessages({
  success: {
    defaultMessage: "Success",
    id: "INKsSL",
    description: "Transaction event status - success",
  },
  failure: {
    defaultMessage: "Failure",
    id: "e4UtKH",
    description: "Transaction event status - failure",
  },
  request: {
    defaultMessage: "Requested",
    id: "++8ZWj",
    description: "Transaction event status - requested",
  },
  info: {
    defaultMessage: "Info",
    id: "if9gAZ",
    description: "Transaction event status - unknown status, info without event data",
  },
});

export const transactionEventTypeMessages = defineMessages({
  AUTHORIZATION: {
    defaultMessage: "Authorization",
    id: "qtF0Ft",
    description: "transaction event type, amount was authorized, but not captured",
  },
  CHARGE: {
    defaultMessage: "Capture",
    id: "f2WJW7",
    description: "transaction event type, amount was captured from client",
  },
  CANCEL: {
    defaultMessage: "Cancel",
    id: "TLDkvR",
    description: "transaction event type, transaction was cancelled / voided",
  },
  REFUND: {
    defaultMessage: "Refund",
    id: "l3iOju",
    description: "transaction event type, transaction was refunded to client",
  },
  CHARGEBACK: {
    defaultMessage: "Chargeback",
    id: "DVgMit",
    description: "transaction event type, transaction was chargeback by payment provider",
  },
  AUTHORIZATION_ADJUSTMENT: {
    defaultMessage: "Authorization amount adjusted",
    id: "E1C9pp",
    description: "transaction event type, authorization amount was changed",
  },
  REFUND_REVERSED: {
    defaultMessage: "Refund reversed",
    id: "of/+iV",
    description: "transaction event type, refund was reversed, funds are back to store account",
  },
});

export const messages = defineMessages({
  noEvents: {
    defaultMessage: "This transaction doesn't have any events",
    id: "dnbJKr",
  },
});
