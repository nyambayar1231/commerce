// Adapted from saleor-dashboard: src/products/components/ProductMedia/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessage, defineMessages } from "react-intl";

export const messages = defineMessages({
  media: {
    id: "/Mcvt4",
    defaultMessage: "Media",
    description: "section header",
  },
  upload: {
    id: "mGiA6q",
    defaultMessage: "Upload",
    description: "modal button upload",
  },
  uploadHint: {
    id: "/jEC3m",
    defaultMessage: "Drag and drop or click to upload",
    description: "product media gallery dropzone hint",
  },
  uploadHintDrop: {
    id: "KXX8oX",
    defaultMessage: "Drag and drop to upload",
    description: "product media gallery dropzone hint when click-to-upload is disabled",
  },
});

// react-intl's defineMessages cannot infer values; the count message is typed on its own.
export const uploadRejectedMessage = defineMessage<{ count: number }>({
  id: "d3IQVN",
  defaultMessage:
    "{count, plural, one {# file was skipped} other {# files were skipped}} (not an image)",
  description: "warning when client-side validation rejects product media files before upload",
});
