// Adapted from saleor-dashboard: src/products/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's product list and detail queries, limited to our single channel and the fields the
// list and the update page show: search, sort, where filters and cursor pagination. The category
// search feeds the update page's category picker (Saleor's src/searches/useCategorySearch.ts).
import { gql } from "@apollo/client";

import { pageInfoFragment } from "../fragments/pageInfo";
import {
  productDetailsFragment,
  productListRowFragment,
  productVariantDetailsFragment,
} from "../fragments/products";

export const productList = gql`
  query ProductList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $search: String
    $sort: ProductOrder
    $where: ProductWhereInput
  ) {
    products(
      first: $first
      after: $after
      last: $last
      before: $before
      search: $search
      sortBy: $sort
      where: $where
    ) {
      edges {
        node {
          ...ProductListRow
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${productListRowFragment}
  ${pageInfoFragment}
`;

export const productDetails = gql`
  query ProductDetails($id: ID!) {
    product(id: $id) {
      ...ProductDetails
    }
  }
  ${productDetailsFragment}
`;

// Saleor's ProductMediaById: the image open in the URL (`mainImage: mediaById`) and the product's
// other images for the navigation, as small WebP thumbnails. No metadata dialog in our page.
export const productMediaById = gql`
  query ProductMediaById($productId: ID!, $mediaId: ID!) {
    product(id: $productId) {
      id
      name
      mainImage: mediaById(id: $mediaId) {
        id
        alt
        url
        type
        oembedData
      }
      media {
        id
        url(size: 128, format: WEBP)
        alt
        type
        oembedData
      }
    }
  }
`;

export const productVariantDetails = gql`
  query ProductVariantDetails($id: ID!) {
    productVariant(id: $id) {
      ...ProductVariantDetails
    }
  }
  ${productVariantDetailsFragment}
`;

// Saleor's ProductVariantCreateData: the product the new variant belongs to, with its variants for
// the navigation (no media, product type, attributes or channel listings yet).
export const productVariantCreateData = gql`
  query ProductVariantCreateData($id: ID!) {
    product(id: $id) {
      id
      name
      variants {
        id
        name
        sku
      }
    }
  }
`;

export const categorySearch = gql`
  query SearchCategories($first: Int!, $after: String, $filter: CategoryFilterInput) {
    search: categories(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          name
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${pageInfoFragment}
`;
