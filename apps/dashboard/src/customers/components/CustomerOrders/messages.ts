// Copied from saleor-dashboard: src/customers/components/CustomerOrders/messages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Without the channel column's title (one channel).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "1LiVhv",
    defaultMessage: "Recent Orders",
    description: "section header",
  },
  viewAll: {
    id: "3+990c",
    defaultMessage: "View all orders",
    description: "button",
  },
  empty: {
    id: "RlfqSV",
    defaultMessage: "No orders found",
  },
  orderColumn: {
    id: "xmv4OJ",
    defaultMessage: "Order",
    description: "customer recent orders table column: order number",
  },
  dateColumn: {
    id: "ri3kK9",
    defaultMessage: "Date",
    description: "order placement date",
  },
  statusColumn: {
    id: "7sJ04i",
    defaultMessage: "Order status",
    description: "customer recent orders table column: fulfillment status",
  },
  totalColumn: {
    id: "qiBefD",
    defaultMessage: "Total",
    description: "customer recent orders table column: order total including shipping and tax",
  },
});
