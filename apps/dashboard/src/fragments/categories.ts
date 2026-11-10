// Adapted from saleor-dashboard: src/fragments/categories.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's Category (list rows) and CategoryDetails fragments, limited to our fields: no metadata,
// background image or SEO yet.
import { gql } from "@apollo/client";

export const categoryFragment = gql`
  fragment Category on Category {
    id
    name
    children {
      totalCount
    }
    products {
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
