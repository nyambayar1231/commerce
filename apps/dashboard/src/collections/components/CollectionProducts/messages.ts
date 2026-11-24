// Adapted from saleor-dashboard: src/collections/components/CollectionProducts/{ProductsTable,
// ProductTableItem}.tsx and src/components/ChannelsAvailabilityDropdown/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ids. The availability labels are the collection list's wording (published, scheduled to
// publish, otherwise not published); "Scheduled" is ours, the brief's label.
import { defineMessage, defineMessages } from "react-intl";

export const titleMessage = defineMessage<{ name: string }>({
  id: "/dnWE8",
  defaultMessage: "Products in {name}",
  description: "products in collection",
});

// react-intl's defineMessages cannot infer values; a message with values is typed on its own.
export const selectedCountMessage = defineMessage<{ number: number }>({
  id: "qu/hXD",
  defaultMessage: "Selected {number} items",
});

export const messages = defineMessages({
  assignProduct: {
    id: "scHVdW",
    defaultMessage: "Assign product",
    description: "button",
  },
  name: {
    id: "6AMFki",
    defaultMessage: "Name",
    description: "product name",
  },
  availability: {
    id: "Oe62bR",
    defaultMessage: "Availability",
    description: "product availability",
  },
  unassign: {
    id: "67V0c0",
    defaultMessage: "Unassign",
    description: "unassign product from collection, button",
  },
  empty: {
    id: "Q1Uzbb",
    defaultMessage: "No products found",
  },
  published: {
    id: "sdA14A",
    defaultMessage: "Published",
    description: "Status label when object is published in a channel",
  },
  notPublished: {
    id: "zepg6k",
    defaultMessage: "Not published",
    description: "collection availability status when not published",
  },
  scheduled: {
    id: "45e+O4",
    defaultMessage: "Scheduled",
    description: "Status label when object is scheduled to publish in a channel",
  },
  unassignDialogTitle: {
    id: "5OtU+V",
    defaultMessage: "Unassign products from collection",
    description: "dialog title",
  },
  productAdded: {
    id: "56vUeQ",
    defaultMessage: "Added product to collection",
  },
  productRemoved: {
    id: "WW+Ruy",
    defaultMessage: "Deleted product from collection",
  },
  unassignProduct: {
    id: "x44H53",
    defaultMessage: "Unassign product",
    description: "unassign a product from the collection, row button tooltip",
  },
});
