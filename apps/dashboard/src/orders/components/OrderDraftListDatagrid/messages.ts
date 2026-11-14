// Adapted from saleor-dashboard: src/orders/components/OrderDraftListDatagrid/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's draft list column titles, without the channel column (single channel).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  emptyText: {
    defaultMessage: "No orders found",
    id: "RlfqSV",
  },
});

export const columnsMessages = defineMessages({
  number: {
    defaultMessage: "Number",
    id: "kFkPWB",
  },
  date: {
    id: "mCP0UD",
    defaultMessage: "Date",
    description: "order draft creation date",
  },
  customer: {
    id: "hkENym",
    defaultMessage: "Customer",
  },
  total: {
    id: "1Uj0Wd",
    defaultMessage: "Total",
    description: "order draft total price",
  },
});
