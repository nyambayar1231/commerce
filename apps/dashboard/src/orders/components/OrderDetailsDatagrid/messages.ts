// Adapted from saleor-dashboard: src/orders/components/OrderDetailsDatagrid/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  product: {
    id: "WE8IFE",
    defaultMessage: "Product",
    description: "product name",
  },
  variantName: {
    id: "OK5+Fh",
    defaultMessage: "Variant",
  },
  sku: {
    id: "8J81ri",
    defaultMessage: "SKU",
    description: "ordered product sku",
  },
  quantity: {
    id: "tvpAXl",
    defaultMessage: "Quantity",
    description: "ordered product quantity",
  },
  price: {
    id: "b810WJ",
    defaultMessage: "Price",
    description: "product price",
  },
  total: {
    id: "qT6YYk",
    defaultMessage: "Total",
    description: "order line total price",
  },
});
