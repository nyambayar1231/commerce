// Adapted from saleor-dashboard: src/fragments/products.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's row: Saleor's ProductWithChannelListings fragment, limited to our single
// channel and the fields the list's columns show (no thumbnail until M2.5).
import { gql } from "@apollo/client";

export const productListRowFragment = gql`
  fragment ProductListRow on Product {
    id
    name
    isPublished
    publishedAt
    minimalVariantPrice {
      amount
      currency
    }
    category {
      id
      name
    }
    created
    updatedAt
  }
`;
