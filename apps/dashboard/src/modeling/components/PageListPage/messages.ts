// Adapted from saleor-dashboard: src/modeling/components/PageListPage/messages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ids. The page-type tabs, the bulk publish/unpublish labels and the "Create model type"
// option are not here (no page types; the API has no bulk publish).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  searchPlaceholder: {
    id: "/x7Y7U",
    defaultMessage: "Search models",
    description: "search models placeholder",
  },
  createModel: {
    id: "pyiyxe",
    defaultMessage: "Create model",
    description: "button",
  },
  bulkDelete: {
    id: "CQKgD/",
    defaultMessage: "Delete model",
    description: "bulk actions button label",
  },
});
