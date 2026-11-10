// Adapted from saleor-dashboard: src/categories/components/CategoryListDatagrid/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessage, defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  name: {
    id: "6AMFki",
    defaultMessage: "Name",
    description: "product name",
  },
  sidebarSubcategories: {
    id: "lDPwGU",
    defaultMessage: "Subs",
    description: "short subcategory count column header in category sidebar",
  },
  sidebarProducts: {
    id: "a5eZlA",
    defaultMessage: "Prods",
    description: "short product count column header in category sidebar",
  },
  categoryName: {
    id: "kgVqk1",
    defaultMessage: "Category name",
  },
  subcategories: {
    defaultMessage: "Subcategories",
    id: "F7DxHw",
  },
  numberOfProducts: {
    id: "cLcy6F",
    defaultMessage: "Number of products",
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
