// Adapted from saleor-dashboard: src/auth/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's UserDetails query, limited to the fields our API has.
import { gql } from "@apollo/client";

import { userFragment } from "../fragments/auth";

export const userDetailsQuery = gql`
  query UserDetails {
    me {
      ...User
    }
  }
  ${userFragment}
`;
