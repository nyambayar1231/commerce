// Adapted from saleor-dashboard: src/products/components/CreateProductDialog/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's title, description and created messages; its product-type messages are dropped because
// we create products without a product type (M2 decision 5). The description is ours: one dialog
// creates the product and its priced default variant (PLAN M14).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "u2QjRn",
    defaultMessage: "Create product",
    description: "create product dialog title",
  },
  description: {
    id: "471aPf",
    defaultMessage:
      "New products are published at once, with one variant at this price. You can add more variants after creating it.",
    description: "create product dialog description",
  },
  name: {
    id: "HAlOn1",
    defaultMessage: "Name",
  },
  // The same message as ProductVariantPrice's price label (id 4hl9rS).
  price: {
    id: "4hl9rS",
    defaultMessage: "Price",
    description: "variant price in channel",
  },
  created: {
    id: "DO8+uV",
    defaultMessage: "Product created",
  },
});
