// Adapted from saleor-dashboard: src/fragments/products.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's row: Saleor's ProductWithChannelListings fragment, limited to our single
// channel and the fields the list's columns show. `thumbnail` feeds the name column (Saleor's
// ThumbnailCell).
import { gql } from "@apollo/client";

import { stockFragment } from "./warehouses";

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
    thumbnail {
      url
    }
  }
`;

// Saleor's ProductMedia fragment: the tile image at size 1024, its alt text and sort order.
// Images only (ARCHITECTURE §4), so there is no oEmbed thumbnail to unwrap.
export const productMediaFragment = gql`
  fragment ProductMedia on ProductMedia {
    id
    alt
    sortOrder
    url(size: 1024)
    type
    oembedData
  }
`;

// The variants grid's row (Saleor's ProductDetailsVariant fragment, limited to our single channel):
// the fields the product page's Variants card shows and edits. The grid's own mutations select it
// too, so Apollo's cache updates the edited row from the payload without a refetch.
export const productVariantGridRowFragment = gql`
  fragment ProductVariantGridRow on ProductVariant {
    id
    name
    sku
    price {
      amount
      currency
    }
    stocks {
      id
      quantity
      warehouse {
        id
      }
    }
  }
`;

// The product detail page's fields: Saleor's ProductDetails fragment limited to what the update
// page shows (no product type, attributes, SEO or metadata yet). The variants feed the editable
// Variants grid (their stocks feed its per-warehouse columns); `media` feeds the Media card;
// `price` is the single channel's price.
export const productDetailsFragment = gql`
  fragment ProductDetails on Product {
    id
    name
    slug
    description
    category {
      id
      name
    }
    isPublished
    publishedAt
    updatedAt
    media {
      ...ProductMedia
    }
    variants {
      ...ProductVariantGridRow
    }
  }
  ${productVariantGridRowFragment}
`;

// The variant detail page's fields: Saleor's ProductVariant fragment limited to the cards the page
// shows — its chosen media feed the Media card, its per-warehouse stocks the Inventory card — plus
// the product's media (the card and the selection dialog offer them in gallery order) and its
// variants for the navigation (their first image as a thumbnail; no attributes, weight or channel
// listings yet).
export const productVariantDetailsFragment = gql`
  fragment ProductVariantDetails on ProductVariant {
    id
    name
    sku
    trackInventory
    price {
      amount
      currency
    }
    stocks {
      ...Stock
    }
    media {
      ...ProductMedia
    }
    product {
      id
      name
      media {
        ...ProductMedia
      }
      variants {
        id
        name
        sku
        media {
          id
          url(size: 128, format: WEBP)
        }
      }
    }
  }
  ${stockFragment}
  ${productMediaFragment}
`;
