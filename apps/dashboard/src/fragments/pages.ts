// Adapted from saleor-dashboard: src/modeling/fragments.ts and src/fragments/pages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's PageDetails fragment, limited to our fields: no page type, attributes, SEO, metadata,
// translations or per-channel visibility (single channel, so we read the page's own state).
import { gql } from "@apollo/client";

export const pageDetailsFragment = gql`
  fragment PageDetails on Page {
    id
    title
    slug
    content
    isPublished
    publishedAt
  }
`;
