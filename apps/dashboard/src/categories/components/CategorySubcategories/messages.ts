// Adapted from saleor-dashboard: src/categories/components/CategorySubcategories/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The "Collapse all" message comes with tree rows in the sidebar.
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
  deleteSelected: {
    id: "U4By91",
    defaultMessage: "Delete categories",
    description: "bulk delete selected subcategories, button tooltip",
  },
  empty: {
    id: "4piZ1P",
    defaultMessage: "No categories found",
    description: "empty state when this category has no subcategories",
  },
  create: {
    id: "UycVMp",
    defaultMessage: "Create subcategory",
    description: "button",
  },
});
