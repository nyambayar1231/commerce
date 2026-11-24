// Adapted from saleor-dashboard: src/structures/components/MenuList/MenuList.tsx and
// src/modeling/components/PageListDatagrid/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's column titles and empty-row text. "Search structures" and "Delete structures" are ours:
// Saleor's list filters through its presets bar, which we don't have, and its bulk button says
// "Remove".
import { defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  name: {
    id: "qL9Oi9",
    defaultMessage: "Structure Title",
  },
  items: {
    id: "U86VKF",
    defaultMessage: "Items",
    description: "number of structures",
  },
});

export const messages = defineMessages({
  empty: {
    id: "xrF9JK",
    defaultMessage: "No structures found",
  },
  searchPlaceholder: {
    id: "PWKArE",
    defaultMessage: "Search structures",
    description: "search structures placeholder",
  },
  bulkDelete: {
    id: "xccRhL",
    defaultMessage: "Delete structures",
    description: "bulk actions button label",
  },
});
