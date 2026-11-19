// Copied from saleor-dashboard: src/collections/components/CreateCollectionDialog/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ids. The description keeps Saleor's wording (the detail page edits the rest later); the
// dialog asks for the name only, so Saleor's "Collection Description" field message is not here.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "ttMauu",
    defaultMessage: "Create collection",
    description: "window title",
  },
  description: {
    id: "ACZg1z",
    defaultMessage:
      "Add a collection. You can edit channels, SEO, media, and metadata after creating it.",
    description: "create collection dialog description",
  },
  name: {
    id: "VZsE96",
    defaultMessage: "Collection Name",
  },
  created: {
    id: "6LqbaB",
    defaultMessage: "Collection created",
  },
});
