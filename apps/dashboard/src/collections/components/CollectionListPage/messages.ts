// Copied from saleor-dashboard: src/collections/components/CollectionListPage/CollectionListPage.tsx,
// src/collections/components/CollectionListDatagrid/messages.ts and
// src/components/ChannelsAvailabilityDropdown/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ids. "All Collections" is Saleor's filter-presets label, shown as the page's heading
// without presets and as the status select's "no filter" option; the other two options are the
// grid's availability labels.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  allCollections: {
    id: "G4g5Ii",
    defaultMessage: "All Collections",
    description: "tab name",
  },
  searchCollection: {
    id: "eRqx44",
    defaultMessage: "Search collections...",
  },
  bulkCollectionDelete: {
    id: "FTYkgw",
    defaultMessage: "Delete collections",
  },
  createCollection: {
    id: "jyaAlB",
    defaultMessage: "Create collection",
    description: "button",
  },
  statusFilterLabel: {
    id: "UxdBmI",
    defaultMessage: "Availability",
    description: "collection availability",
  },
  statusPublished: {
    id: "sdA14A",
    defaultMessage: "Published",
    description: "Status label when object is published in a channel",
  },
  statusHidden: {
    id: "9KzuFr",
    defaultMessage: "Hidden",
    description: "Product availability status when not visible in a channel",
  },
});
