// Adapted from saleor-dashboard: src/collections/components/CollectionDetails/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's collection name label; the description keeps the dashboard's common "Description" text
// (Saleor's commonMessages.description) because we edit it as plain text, as the category page does.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  name: {
    id: "/WXs6H",
    defaultMessage: "Name",
    description: "collection name",
  },
  description: {
    id: "Q8Qw5B",
    defaultMessage: "Description",
  },
});
