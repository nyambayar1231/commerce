// Adapted from saleor-dashboard: src/modeling/components/PageListDatagrid/messages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's column titles and model-status labels. "Scheduled to publish" keeps the collection
// list's id and wording (one channel, and the brief names this label); "Content type" is not a
// column here (no page types).
import { defineMessages } from "react-intl";

export const columnsMessages = defineMessages({
  title: {
    id: "0XHXTZ",
    defaultMessage: "Title",
    description: "column header",
  },
  slug: {
    id: "kIcyUo",
    defaultMessage: "Slug",
    description: "column header",
  },
  visible: {
    id: "wLB8B3",
    defaultMessage: "Visibility",
    description: "column header",
  },
});

export const messages = defineMessages({
  empty: {
    id: "zv9OGI",
    defaultMessage: "No models found",
  },
  published: {
    id: "GhSB79",
    defaultMessage: "Published",
    description: "model status",
  },
  notPublished: {
    id: "3dJ2Sc",
    defaultMessage: "Not published",
    description: "model status",
  },
  scheduled: {
    id: "GzbSQk",
    defaultMessage: "Scheduled to publish",
    description: "Status label when object is scheduled to publish in a channel",
  },
});
