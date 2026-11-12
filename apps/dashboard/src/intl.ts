// Adapted from saleor-dashboard: src/intl.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Message ids are formatjs's default content hash, the same as Saleor's:
// base64(sha512(`${defaultMessage}#${description}`)).slice(0, 6)
import { defineMessages } from "react-intl";

export const commonMessages = defineMessages({
  dashboard: {
    id: "hzSNj4",
    defaultMessage: "Dashboard",
  },
  email: {
    id: "hJZwTS",
    defaultMessage: "Email address",
  },
  error: {
    id: "KN7zKn",
    defaultMessage: "Error",
  },
  firstName: {
    id: "Q6wcZ5",
    defaultMessage: "First Name",
  },
  generalInformations: {
    id: "pkUbrL",
    defaultMessage: "General Information",
  },
  info: {
    id: "we4Lby",
    defaultMessage: "Info",
  },
  lastName: {
    id: "aheQdn",
    defaultMessage: "Last Name",
  },
  noOfRows: {
    id: "2HfSiT",
    defaultMessage: "No. of rows",
    description: "pagination",
  },
  requiredField: {
    id: "TKmub+",
    defaultMessage: "This field is required",
  },
  success: {
    id: "xrKHS6",
    defaultMessage: "Success",
  },
  warning: {
    id: "3SVI5p",
    defaultMessage: "Warning",
  },
});

export const buttonMessages = defineMessages({
  back: {
    id: "0OfZJA",
    defaultMessage: "Back",
    description: "button",
  },
  close: {
    id: "rbrahO",
    defaultMessage: "Close",
  },
  create: {
    id: "H5NKfr",
    defaultMessage: "Create",
    description: "button",
  },
  delete: {
    id: "ufmuTp",
    defaultMessage: "Delete",
    description: "button",
  },
  save: {
    id: "RaycYK",
    defaultMessage: "Save",
    description: "button",
  },
});

// Only the sections on our roadmap (M0.3); ids copied unchanged from Saleor.
export const sectionNames = defineMessages({
  catalog: {
    id: "P5HhQl",
    defaultMessage: "Catalog",
    description: "catalog section name",
  },
  categories: {
    id: "sK1FPw",
    defaultMessage: "Categories",
    description: "categories section name",
  },
  configuration: {
    id: "xfGZsi",
    defaultMessage: "Configuration",
    description: "configuration section name",
  },
  customers: {
    id: "McN+wq",
    defaultMessage: "Customers",
    description: "customers section name",
  },
  fulfillment: {
    id: "9XYfOt",
    defaultMessage: "Fulfillment",
    description: "fulfillment section name",
  },
  home: {
    id: "4JW9iJ",
    defaultMessage: "Home",
    description: "home section name",
  },
  orders: {
    id: "Ta9j04",
    defaultMessage: "Orders",
    description: "orders section name",
  },
  products: {
    id: "K8xNLe",
    defaultMessage: "Products",
    description: "products section name",
  },
});

// Saleor's commonStatusMessages, orderStatusMessages and paymentStatusMessages, limited to the
// statuses our orders can have (no draft, unconfirmed, returned or expired orders).
export const commonStatusMessages = defineMessages({
  cancelled: {
    id: "dOQB9o",
    defaultMessage: "Cancelled",
    description: "payment status",
  },
});

export const orderStatusMessages = defineMessages({
  fulfilled: {
    id: "pkjXPD",
    defaultMessage: "Fulfilled",
    description: "order status",
  },
  partiallyFulfilled: {
    id: "PbqNhi",
    defaultMessage: "Partially fulfilled",
    description: "order status",
  },
  unfulfilled: {
    id: "oB0y5Y",
    defaultMessage: "Unfulfilled",
    description: "order status",
  },
});

export const paymentStatusMessages = defineMessages({
  paid: {
    id: "2pw5dQ",
    defaultMessage: "Fully paid",
    description: "payment status",
  },
  partiallyPaid: {
    id: "INNPVX",
    defaultMessage: "Partially paid",
    description: "payment status",
  },
  partiallyRefunded: {
    id: "OGemtu",
    defaultMessage: "Partially refunded",
    description: "payment status",
  },
  refunded: {
    id: "XJSRDK",
    defaultMessage: "Fully refunded",
    description: "payment status",
  },
  unpaid: {
    id: "FBtqtl",
    defaultMessage: "Unpaid",
    description: "payment status",
  },
  pending: {
    id: "hLUYBt",
    defaultMessage: "Pending",
    description: "payment status",
  },
  authorized: {
    id: "SJhFLU",
    defaultMessage: "Authorised",
    description: "payment status",
  },
  partiallyAuthorized: {
    id: "IIlJDr",
    defaultMessage: "Partially authorised",
    description: "payment status",
  },
  overcharged: {
    id: "4VLj3S",
    defaultMessage: "Overcharged",
    description: "overcharged order status",
  },
});
