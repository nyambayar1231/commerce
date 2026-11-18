// Adapted from saleor-dashboard: src/products/components/ProductVariants/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's strings for the editable variants card: the header, the three columns, the row's
// "Edit variant" action and the empty state. Search, bulk actions, the generator and the
// unsaved-changes dialog are not part of it.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "1WbTJ5",
    defaultMessage: "Variants",
    description: "product variants, title",
  },
  name: {
    id: "J4E+jp",
    defaultMessage: "Variant name",
  },
  sku: {
    id: "k4brJy",
    defaultMessage: "SKU",
  },
  price: {
    id: "4hl9rS",
    defaultMessage: "Price",
    description: "variant price in channel",
  },
  addVariant: {
    id: "3C3Nj5",
    defaultMessage: "Add variant",
    description: "button",
  },
  editVariant: {
    id: "wj5c9k",
    defaultMessage: "Edit variant",
    description: "product variants grid, row action that opens the variant page",
  },
  empty: {
    id: "IH47ID",
    defaultMessage: "Use button above to add new product variants",
  },
});
