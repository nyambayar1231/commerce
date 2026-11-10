// Adapted from saleor-dashboard: src/products/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product section's mutations. `productCreate` returns just the new product's id: the list
// navigates to its detail page. `productUpdate` returns the product so the form picks up the
// saved values (including the server-side publication date).
import { gql } from "@apollo/client";

import { productErrorFragment } from "../fragments/errors";
import { productDetailsFragment } from "../fragments/products";

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
