// Adapted from saleor-dashboard: src/fragments/errors.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { gql } from "@apollo/client";

export const productErrorFragment = gql`
  fragment ProductError on ProductError {
    code
    field
    message
  }
`;
