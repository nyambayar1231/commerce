// Adapted from saleor-dashboard: src/auth/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor logs in through @saleor/sdk's tokenCreate and keeps JWTs in the browser; our API sets an
// HttpOnly session cookie instead (ADR-0006), so tokenCreate returns only the user and errors,
// and `logout` is a mutation (ARCHITECTURE.md §4 deviations).
import { gql } from "@apollo/client";

import { userFragment } from "../fragments/auth";

export const tokenCreateMutation = gql`
  mutation TokenCreate($email: String!, $password: String!) {
    tokenCreate(email: $email, password: $password) {
      user {
        ...User
      }
      errors {
        field
        code
        message
      }
    }
  }
  ${userFragment}
`;

export const logoutMutation = gql`
  mutation Logout {
    logout {
      errors {
        code
      }
    }
  }
`;
