// Adapted from saleor-dashboard: src/products/components/ProductListDatagrid/messages.ts and
// src/categories/components/CategoryProducts/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's column titles, limited to the columns we can fill. The availability labels keep the
// ids the category card already uses.
import { defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  name: {
    id: "x/ZVlU",
    defaultMessage: "Product",
  },
  availability: {
    id: "+VEhV8",
    defaultMessage: "Availability",
    description: "product channels",
  },
  price: {
    id: "b810WJ",
    defaultMessage: "Price",
    description: "product price",
  },
  category: {
    id: "9qKFTA",
    defaultMessage: "Category",
    description: "Product category",
  },
  updatedAt: {
    id: "kVTWtR",
    defaultMessage: "Last updated",
    description: "product updated at",
  },
  created: {
    id: "acgbDa",
    defaultMessage: "Created at",
    description: "product created at",
  },
});

export const messages = defineMessages({
  noData: {
    id: "Q1Uzbb",
    defaultMessage: "No products found",
  },
  published: {
    id: "sdA14A",
    defaultMessage: "Published",
    description: "Status label when object is published in a channel",
  },
  hidden: {
    id: "9KzuFr",
    defaultMessage: "Hidden",
    description: "Product availability status when not visible in a channel",
  },
});
