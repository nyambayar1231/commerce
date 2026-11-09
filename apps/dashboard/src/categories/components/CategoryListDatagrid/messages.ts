// Adapted from saleor-dashboard: src/categories/components/CategoryListDatagrid/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The sidebar column messages come with M2.1.8c.
import { defineMessage, defineMessages } from "react-intl";

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

export const loadMoreSubcategoriesMessage = defineMessage<{ count: number }>({
  id: "i8FLQQ",
  defaultMessage: "Load {count, plural, one {# more subcategory} other {# more subcategories}}",
  description: "load more subcategories in category tree",
});
