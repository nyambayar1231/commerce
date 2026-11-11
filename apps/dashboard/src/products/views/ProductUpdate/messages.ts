// Adapted from saleor-dashboard: src/products/views/ProductUpdate/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessage, defineMessages } from "react-intl";

export const productUpdatePageMessages = defineMessages({
  savedChanges: {
    id: "rqiCWU",
    defaultMessage: "Saved changes",
  },
  productRemoved: {
    id: "vlVTmY",
    defaultMessage: "Product removed",
  },
  mediaReorderSuccess: {
    id: "JV3DcT",
    defaultMessage: "Media order updated",
    description: "success notification when product media gallery order is saved",
  },
});

// Messages with ICU values need their own types (react-intl cannot infer them in defineMessages).
export const mediaUploadSuccessCountMessage = defineMessage<{ count: number }>({
  id: "Yxoq3Y",
  defaultMessage: "{count, plural, one {# image added} other {# images added}}",
  description: "success notification when one or more product images finish uploading",
});

// Saleor's errorMessages.imgageUploadErrorTitle (src/intl.ts).
export const mediaUploadErrorTitleMessage = defineMessage({
  id: "Yo2kC+",
  defaultMessage: "Couldn't process image",
});

export const mediaUploadAllFailedMessage = defineMessage<{ count: number }>({
  id: "2z3+WY",
  defaultMessage: "{count, plural, one {Failed to upload image} other {Failed to upload # images}}",
  description: "error notification when all product image uploads in a batch failed",
});

export const mediaUploadPartialMessage = defineMessage<{ success: number; failed: number }>({
  id: "lxP7Rb",
  defaultMessage:
    "{success, plural, one {# image} other {# images}} added, {failed, plural, one {# failed} other {# failed}}",
  description: "warning notification when some product image uploads in a batch failed",
});

export const mediaDeleteSuccessMessage = defineMessage<{ counter: number }>({
  id: "F2xa5K",
  defaultMessage: "{counter,plural,one{Media deleted} other{# media items deleted}}",
  description: "success notification when product media items are deleted",
});
