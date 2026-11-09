// Adapted from saleor-dashboard: src/graphql/client.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the core: Saleor also attaches auth (token refresh), file uploads, generated type policies
// and a schema-lock transform. Those arrive when we need them (login is M1).
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

import { getApiUrl } from "../config";

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: getApiUrl(),
    // Sends the session cookie cross-origin once login exists (M1), as Saleor does.
    credentials: "include",
    // The API's CSRF protection requires this header on every request (ARCHITECTURE.md).
    headers: { "x-graphql-yoga-csrf": "1" },
  }),
  cache: new InMemoryCache(),
});
