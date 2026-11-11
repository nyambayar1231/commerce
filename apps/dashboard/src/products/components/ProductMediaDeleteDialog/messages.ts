// Adapted from saleor-dashboard: src/products/components/ProductMediaDeleteDialog/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Images only and single delete: the bulk and video messages are not ported.
import { defineMessages } from "react-intl";

export const productMediaDeleteDialogMessages = defineMessages({
  deleteImageTitle: {
    id: "uCn/rd",
    defaultMessage: "Delete Image",
    description: "dialog header",
  },
  deleteImageConfirmation: {
    id: "VEext+",
    defaultMessage: "Are you sure you want to delete this image?",
  },
});
