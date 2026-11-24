// Adapted from saleor-dashboard: src/structures/components/MenuItems/messages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ids and English text. Undo is Saleor's button message, kept local because our shared
// buttonMessages does not carry it yet.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  itemsSectionHeader: {
    id: "TD/GhR",
    defaultMessage: "Structure Items",
    description: "header",
  },
  createNewItem: {
    id: "XvbjyW",
    defaultMessage: "Create new item",
    description: "add new structure",
  },
  undo: {
    id: "vN3qdA",
    defaultMessage: "Undo",
    description: "button",
  },
});
