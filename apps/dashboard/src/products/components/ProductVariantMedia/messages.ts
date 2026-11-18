// Adapted from saleor-dashboard: src/products/components/ProductVariantMedia/ProductVariantMedia.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  // The same id as the product page's card header, so both read "Media" in every language.
  media: {
    id: "/Mcvt4",
    defaultMessage: "Media",
    description: "section header",
  },
  chooseMedia: {
    id: "9qL+iN",
    defaultMessage: "Choose photos",
    description: "button",
  },
  selectSpecificVariant: {
    id: "QGmiKZ",
    defaultMessage: "No photos chosen for this variant.",
    description: "variant media empty state",
  },
});
