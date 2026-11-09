// Adapted from saleor-dashboard: src/auth/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's UserDetails query, limited to the fields our API has (permissions arrive in M1.2).
import { gql } from "@apollo/client";

export const userDetailsQuery = gql`
  query UserDetails {
    me {
      id
      email
      firstName
      lastName
      isStaff
    }
  }
`;
