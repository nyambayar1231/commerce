// Adapted from saleor-dashboard: src/categories/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's CategoryDetails query without children/products pagination (M2.1.6 / M2.2).
import { gql } from "@apollo/client";

import { categoryDetailsFragment } from "../fragments/categories";

export const categoryDetailsQuery = gql`
  query CategoryDetails($id: ID!) {
    category(id: $id) {
      ...CategoryDetails
    }
  }
  ${categoryDetailsFragment}
`;
