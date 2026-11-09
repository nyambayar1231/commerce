// Adapted from saleor-dashboard: src/categories/components/CategoryListDatagrid/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The tree ("load more") and sidebar column messages come with M2.1.8b/c.
import { defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  categoryName: {
    id: "kgVqk1",
    defaultMessage: "Category name",
  },
  subcategories: {
    defaultMessage: "Subcategories",
    id: "F7DxHw",
  },
});

export const messages = defineMessages({
  noData: {
    defaultMessage: "No categories found",
    id: "dM86a2",
  },
});
