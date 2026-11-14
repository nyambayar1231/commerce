// Adapted from saleor-dashboard: src/orders/components/OrderDraftDetailsDatagrid/messages.ts and
// OrderDraftDetailsProducts/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  product: {
    id: "x/ZVlU",
    defaultMessage: "Product",
  },
  quantity: {
    id: "nEWp+k",
    defaultMessage: "Quantity",
    description: "quantity of ordered products",
  },
  variantName: {
    id: "OK5+Fh",
    defaultMessage: "Variant",
  },
  price: {
    id: "32dfzI",
    defaultMessage: "Price",
    description: "price or ordered products",
  },
  total: {
    id: "lVwmf5",
    defaultMessage: "Total",
    description: "total price of ordered products",
  },
  status: {
    id: "tzMNF3",
    defaultMessage: "Status",
  },
});

export const messages = defineMessages({
  emptyText: {
    id: "Q1Uzbb",
    defaultMessage: "No products found",
  },
  productDetails: {
    id: "VYK2nN",
    defaultMessage: "Product details",
  },
  deleteOrder: {
    id: "LKD6fB",
    defaultMessage: "Remove product",
  },
  unknownProductFallback: {
    id: "GrMiRT",
    defaultMessage: "this product",
    description: "fallback product name in remove product confirmation dialog",
  },
});

export const lineAlertMessages = defineMessages({
  notExists: {
    id: "ZJOX8n",
    defaultMessage: "Product no longer exists",
    description: "alert message",
  },
});
