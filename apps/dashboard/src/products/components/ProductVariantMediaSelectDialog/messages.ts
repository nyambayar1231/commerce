// Adapted from saleor-dashboard:
// src/products/components/ProductVariantImageSelectDialog/messages.ts (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessage, defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "XCWhKP",
    defaultMessage: "Choose variant photos",
    description: "dialog header",
  },
  subtitle: {
    id: "u30A+K",
    defaultMessage: "Choose product images to assign to this variant.",
    description: "variant media selection dialog subtitle",
  },
  empty: {
    id: "5nQ6yG",
    defaultMessage: "No product media available. Upload images on the product page first.",
    description: "empty state in variant media selection dialog",
  },
  confirm: {
    id: "DJFPzq",
    defaultMessage: "Confirm",
    description: "button",
  },
});

// react-intl's defineMessages cannot infer values; the count badge is typed on its own.
export const selectedCountMessage = defineMessage<{ count: number }>({
  id: "jWTXmC",
  defaultMessage: "{count, plural, one {# selected} other {# selected}}",
  description: "selected media count badge in variant media selection dialog",
});
