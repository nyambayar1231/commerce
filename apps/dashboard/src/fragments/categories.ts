// Adapted from saleor-dashboard: src/fragments/categories.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's Category (list rows) and CategoryDetails fragments, limited to our fields: no product
// counts (M2.2), metadata, background image or SEO yet.
import { gql } from "@apollo/client";

export const categoryFragment = gql`
  fragment Category on Category {
    id
    name
    children {
      totalCount
    }
  }
`;

export const categoryDetailsFragment = gql`
  fragment CategoryDetails on Category {
    id
    name
    slug
    description
    parent {
      id
    }
  }
`;
