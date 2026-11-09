// Adapted from saleor-dashboard: src/categories/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// CategoryUpdate / CategoryDelete come with the detail page (M2.1.4).
import { gql } from "@apollo/client";

import { categoryDetailsFragment } from "../fragments/categories";
import { productErrorFragment } from "../fragments/errors";

export const categoryCreateMutation = gql`
  mutation CategoryCreate($parent: ID, $input: CategoryInput!) {
    categoryCreate(parent: $parent, input: $input) {
      category {
        ...CategoryDetails
      }
      errors {
        ...ProductError
      }
    }
  }
  ${categoryDetailsFragment}
  ${productErrorFragment}
`;
