// Adapted from saleor-dashboard: src/modeling/components/PageDetailsPage/messages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ids where it has the message. Not here: GraphiQL, metadata, translations, SEO, page-type
// settings and the availability-date messages (our availability card is the collection page's).
// The hidden-page note and the save-composition segments are our wording (Saleor's availability
// card is per channel and its save composition has no page entry).
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "lDdj6f",
    defaultMessage: "Create model",
    description: "page header",
  },
  pageCreated: {
    id: "ZwtDkP",
    defaultMessage: "Page created",
  },
  pageUpdated: {
    id: "EAGfdH",
    defaultMessage: "Page updated",
  },
  pageDeleted: {
    id: "VuqfI9",
    defaultMessage: "Page deleted",
  },
  saveCompositionGeneral: {
    id: "9sXFd2",
    defaultMessage: "general",
    description: "Save composition segment for the page title and content",
  },
  saveCompositionAvailability: {
    id: "ganla2",
    defaultMessage: "availability",
    description: "Save composition segment for the page's publish status",
  },
  hiddenPageDescription: {
    id: "gOVext",
    defaultMessage: "Customers cannot find or view this page.",
    description: "Info box description for unpublished pages",
  },
});
