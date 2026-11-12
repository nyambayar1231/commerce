// Adapted from saleor-dashboard: src/customers/components/CustomerListDatagrid/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's messages, without the company name and external reference columns.
import { defineMessage, defineMessages } from "react-intl";

export const messages = defineMessages({
  empty: {
    id: "FpIcp9",
    defaultMessage: "No customers found",
  },
});

export const emptySearchMessage = defineMessage<{ query: string }>({
  id: "0QG3GQ",
  defaultMessage: "No customers found for {query}",
  description: "empty search results on the customer list",
});

export const columnsMessages = defineMessages({
  name: {
    id: "nZDQbr",
    defaultMessage: "Customer name",
    description: "column header",
  },
  email: {
    id: "945a4a",
    defaultMessage: "Customer e-mail",
    description: "column header",
  },
  orders: {
    id: "MTGT8E",
    defaultMessage: "No. of orders",
    description: "column header",
  },
});
