// Adapted from saleor-dashboard: src/collections/components/CollectionListDatagrid/messages.ts and
// src/components/ChannelsAvailabilityDropdown/messages.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's column titles and availability labels. "Published" and "Scheduled to publish" keep
// Saleor's ids; "Not published" is our wording for Saleor's per-channel "Unpublished" (one channel,
// and the brief names this label).
import { defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  name: {
    id: "VZsE96",
    defaultMessage: "Collection Name",
  },
  noOfProducts: {
    id: "mWQt3s",
    defaultMessage: "No. of Products",
  },
  availability: {
    id: "UxdBmI",
    defaultMessage: "Availability",
    description: "collection availability",
  },
});

export const messages = defineMessages({
  empty: {
    id: "Yw+9F7",
    defaultMessage: "No collections found",
  },
  published: {
    id: "sdA14A",
    defaultMessage: "Published",
    description: "Status label when object is published in a channel",
  },
  notPublished: {
    id: "zepg6k",
    defaultMessage: "Not published",
    description: "collection availability status when not published",
  },
  scheduled: {
    id: "GzbSQk",
    defaultMessage: "Scheduled to publish",
    description: "Status label when object is scheduled to publish in a channel",
  },
});
