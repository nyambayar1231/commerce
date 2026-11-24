// Adapted from saleor-dashboard: src/fragments/collections.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's CollectionDetails and CollectionProduct fragments, limited to our fields: no metadata,
// background image, SEO or per-channel listings (single channel, so we read the collection's and the
// product's own publication state).
import { gql } from "@apollo/client";

export const collectionDetailsFragment = gql`
  fragment CollectionDetails on Collection {
    id
    name
    slug
    description
    isPublished
    publishedAt
  }
`;

// Saleor's CollectionProduct (src/collections/fragments.ts) without the product type and channel
// listings: the products card shows the thumbnail, the name and the availability.
export const collectionProductFragment = gql`
  fragment CollectionProduct on Product {
    id
    name
    isPublished
    publishedAt
    thumbnail {
      url
    }
  }
`;
