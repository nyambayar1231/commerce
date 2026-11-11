// Adapted from saleor-dashboard: src/products/components/ProductBulkDeleteDialog/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessages } from "react-intl";

export const productBulkDeleteDialogMessages = defineMessages({
  title: {
    id: "F4WdSO",
    defaultMessage: "Delete Products",
    description: "dialog header",
  },
  subtitle: {
    id: "yDkmX7",
    defaultMessage:
      "{counter,plural,one{Are you sure you want to delete this product?} other{Are you sure you want to delete {displayQuantity} products?}}",
    description: "dialog content",
  },
});
