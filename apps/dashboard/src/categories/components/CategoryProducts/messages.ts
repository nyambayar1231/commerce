// Adapted from saleor-dashboard: src/categories/components/CategoryProducts/messages.ts,
// src/collections/components/CollectionProducts/ProductsTable.tsx and
// src/components/ChannelsAvailabilityDropdown/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessage, defineMessages } from "react-intl";

export const titleMessage = defineMessage<{ categoryName: string }>({
  id: "+43JV5",
  defaultMessage: "Products in {categoryName}",
  description: "header",
});

export const messages = defineMessages({
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
  empty: {
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
