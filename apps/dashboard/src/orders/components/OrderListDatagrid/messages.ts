// Adapted from saleor-dashboard: src/orders/components/OrderListDatagrid/messages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's column titles, limited to the columns we can fill.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  emptyText: {
    id: "RlfqSV",
    defaultMessage: "No orders found",
  },
});

export const columnsMessages = defineMessages({
  number: {
    id: "kFkPWB",
    defaultMessage: "Number",
  },
  date: {
    id: "P7PLVj",
    defaultMessage: "Date",
  },
  customer: {
    id: "hkENym",
    defaultMessage: "Customer",
  },
  payment: {
    id: "NmK6zy",
    defaultMessage: "Payment",
  },
  status: {
    id: "NWxomz",
    defaultMessage: "Fulfillment status",
  },
  total: {
    id: "MJ2jZQ",
    defaultMessage: "Total",
  },
});
