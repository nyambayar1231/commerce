// Adapted from saleor-dashboard: src/collections/components/CollectionDetailsPage/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ids. Not here: GraphiQL, metadata, translations, SEO and channel-list messages. The
// collection's hidden-state note is our wording (Saleor's availability card is per channel).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  deleteCollection: {
    id: "uvVmpA",
    defaultMessage: "Delete collection",
    description: "collection detail cogs menu, opens the delete-confirmation dialog",
  },
  allCollections: {
    id: "3TAa8s",
    defaultMessage: "All collections",
    description: "TopNav destination link tooltip to collections list",
  },
  collectionUpdated: {
    id: "E2uiWk",
    defaultMessage: "Collection updated",
  },
  collectionDeleted: {
    id: "Q8wHwJ",
    defaultMessage: "Deleted collection",
  },
  saveCompositionGeneral: {
    id: "ijAoJZ",
    defaultMessage: "general",
    description: "Save composition segment for collection name, slug, description, SEO",
  },
  saveCompositionAvailability: {
    id: "oY/diq",
    defaultMessage: "availability",
    description: "Save composition segment for the collection's publish status",
  },
  hiddenCollectionDescription: {
    id: "yAIhgA",
    defaultMessage: "Customers cannot find or view this collection.",
    description: "Info box description for unpublished collections",
  },
});
