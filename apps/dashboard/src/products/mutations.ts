// Adapted from saleor-dashboard: src/products/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product section's mutations. `productCreate` returns just the new product's id: the list
// navigates to its detail page. `productUpdate` returns the product so the form picks up the
// saved values (including the server-side publication date). The media mutations return the
// product's media in display order, so Apollo's cache is the card's source of truth.
import { gql } from "@apollo/client";

import {
  bulkStockErrorFragment,
  productErrorFragment,
  productVariantStocksDeleteErrorFragment,
} from "../fragments/errors";
import {
  productDetailsFragment,
  productMediaFragment,
  productVariantDetailsFragment,
} from "../fragments/products";

export const productCreateMutation = gql`
  mutation ProductCreate($input: ProductCreateInput!) {
    productCreate(input: $input) {
      product {
        id
      }
      errors {
        ...ProductError
      }
    }
  }
  ${productErrorFragment}
`;

export const productUpdateMutation = gql`
  mutation ProductUpdate($id: ID!, $input: ProductInput!) {
    productUpdate(id: $id, input: $input) {
      product {
        ...ProductDetails
      }
      errors {
        ...ProductError
      }
    }
  }
  ${productDetailsFragment}
  ${productErrorFragment}
`;

export const productDeleteMutation = gql`
  mutation ProductDelete($id: ID!) {
    productDelete(id: $id) {
      errors {
        ...ProductError
      }
    }
  }
  ${productErrorFragment}
`;

// Saleor's ProductBulkDelete: the dialog only needs the errors; the list refetches afterwards.
export const productBulkDeleteMutation = gql`
  mutation ProductBulkDelete($ids: [ID!]!) {
    productBulkDelete(ids: $ids) {
      errors {
        ...ProductError
      }
    }
  }
  ${productErrorFragment}
`;

// Saleor's ProductMediaCreate without the external-URL input (images only): each file is one
// multipart upload. `media` gives the new row's id; `product.media` updates the card's cache.
export const productMediaCreateMutation = gql`
  mutation ProductMediaCreate($product: ID!, $image: Upload, $alt: String) {
    productMediaCreate(input: { alt: $alt, image: $image, product: $product }) {
      errors {
        ...ProductError
      }
      media {
        id
      }
      product {
        id
        media {
          ...ProductMedia
        }
      }
    }
  }
  ${productMediaFragment}
  ${productErrorFragment}
`;

// Saleor's ProductMediaUpdate: the alt text only (our images carry no title or external URL).
export const productMediaUpdateMutation = gql`
  mutation ProductMediaUpdate($id: ID!, $alt: String!) {
    productMediaUpdate(id: $id, input: { alt: $alt }) {
      errors {
        ...ProductError
      }
      product {
        id
        media {
          ...ProductMedia
        }
      }
    }
  }
  ${productMediaFragment}
  ${productErrorFragment}
`;

export const productMediaDeleteMutation = gql`
  mutation ProductMediaDelete($id: ID!) {
    productMediaDelete(id: $id) {
      errors {
        ...ProductError
      }
      product {
        id
        media {
          ...ProductMedia
        }
      }
    }
  }
  ${productMediaFragment}
  ${productErrorFragment}
`;

export const productMediaReorderMutation = gql`
  mutation ProductMediaReorder($productId: ID!, $mediaIds: [ID!]!) {
    productMediaReorder(productId: $productId, mediaIds: $mediaIds) {
      errors {
        ...ProductError
      }
      product {
        id
        media {
          ...ProductMedia
        }
      }
    }
  }
  ${productMediaFragment}
  ${productErrorFragment}
`;

// The variant mutations return the saved variant so the form picks up the server values.
export const variantCreateMutation = gql`
  mutation VariantCreate($input: ProductVariantCreateInput!) {
    productVariantCreate(input: $input) {
      productVariant {
        ...ProductVariantDetails
      }
      errors {
        ...ProductError
      }
    }
  }
  ${productVariantDetailsFragment}
  ${productErrorFragment}
`;

// Saleor's composite VariantUpdate: the stock writes run first and the variant write last, in one
// document, so one Save applies the whole card. Saleor's field order: delete, create, update.
// The delete and create payloads select only the variant's id: their stocks are the values from
// before the update, and Apollo would keep those in its cache over the later, updated ones (the
// same Stock appears several times in one response). The update payloads carry the final stocks.
export const variantUpdateMutation = gql`
  mutation VariantUpdate(
    $id: ID!
    $input: ProductVariantInput!
    $addStocks: [StockInput!]!
    $removeStocks: [ID!]!
    $stocks: [StockInput!]!
  ) {
    productVariantStocksDelete(warehouseIds: $removeStocks, variantId: $id) {
      errors {
        ...ProductVariantStocksDeleteError
      }
      productVariant {
        id
      }
    }
    productVariantStocksCreate(stocks: $addStocks, variantId: $id) {
      errors {
        ...BulkStockError
      }
      productVariant {
        id
      }
    }
    productVariantStocksUpdate(stocks: $stocks, variantId: $id) {
      errors {
        ...BulkStockError
      }
      productVariant {
        ...ProductVariantDetails
      }
    }
    productVariantUpdate(id: $id, input: $input) {
      productVariant {
        ...ProductVariantDetails
      }
      errors {
        ...ProductError
      }
    }
  }
  ${productVariantDetailsFragment}
  ${productErrorFragment}
  ${bulkStockErrorFragment}
  ${productVariantStocksDeleteErrorFragment}
`;

export const variantDeleteMutation = gql`
  mutation VariantDelete($id: ID!) {
    productVariantDelete(id: $id) {
      errors {
        ...ProductError
      }
    }
  }
  ${productErrorFragment}
`;
