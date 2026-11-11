// Adapted from saleor-dashboard: src/graphql/client.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the core: Saleor also attaches auth (token refresh), generated type policies and a
// schema-lock transform. Those arrive when we need them (login is M1). `createUploadLink` is
// Saleor's HTTP link: it sends a graphql-multipart-request-spec request when the variables contain
// a `File`/`Blob` (product media uploads) and a regular JSON POST otherwise.
//
// Saleor's `makeQuery` defaults every query to `cache-and-network` (and additionally sets
// `errorPolicy: "all"` and batched requests): a list shows its cached page at once and then
// refetches, so data changed elsewhere is not stale on return. We port only the fetch policy.
import { ApolloClient, InMemoryCache } from "@apollo/client";
import createUploadLink from "apollo-upload-client/createUploadLink.mjs";

import { getApiUrl } from "../config";

export const apolloClient = new ApolloClient({
  link: createUploadLink({
    uri: getApiUrl(),
    // Sends the session cookie cross-origin once login exists (M1), as Saleor does.
    credentials: "include",
    // The API's CSRF protection requires this header on every request (ARCHITECTURE.md).
    headers: { "x-graphql-yoga-csrf": "1" },
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
});
