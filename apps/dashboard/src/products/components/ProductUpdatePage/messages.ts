// Adapted from saleor-dashboard: src/products/components/ProductUpdatePage/messages.ts and
// src/products/views/ProductUpdate/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The update page's top bar, menu and save-composition strings; only the parts this page uses.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  allProducts: {
    id: "pmXN+Q",
    defaultMessage: "All products",
    description: "TopNav destination link tooltip to products list",
  },
  deleteProduct: {
    id: "j6dFO1",
    defaultMessage: "Delete product",
    description: "product detail cogs menu, opens the delete-confirmation dialog",
  },
  saveCompositionDetails: {
    id: "qcTYIh",
    defaultMessage: "details",
    description: "Save composition segment for product name, SEO, organization, and description",
  },
});
