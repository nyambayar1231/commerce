// Adapted from saleor-dashboard: src/products/components/CreateProductDialog/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's title, description and created messages; its product-type messages are dropped because
// we create products without a product type (M2 decision 5).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "u2QjRn",
    defaultMessage: "Create product",
    description: "create product dialog title",
  },
  description: {
    id: "99q9UB",
    defaultMessage:
      "Add a product. You can set a price, inventory, and availability after creating it.",
    description: "create product dialog description",
  },
  name: {
    id: "HAlOn1",
    defaultMessage: "Name",
  },
  created: {
    id: "DO8+uV",
    defaultMessage: "Product created",
  },
});
