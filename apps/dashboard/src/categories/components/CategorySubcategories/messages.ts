// Adapted from saleor-dashboard: src/categories/components/CategorySubcategories/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The count, empty-state, "Collapse all" and bulk-delete messages come with the list (M2.1.8).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "BdS6CQ",
    defaultMessage: "Subcategories",
    description: "category detail sidebar card title",
  },
  intro: {
    id: "BC/h4y",
    defaultMessage: "Open a child to edit it, or create a new subcategory under this one.",
    description: "category detail sidebar children card intro",
  },
  create: {
    id: "UycVMp",
    defaultMessage: "Create subcategory",
    description: "button",
  },
});
