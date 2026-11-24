import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import type { TypedDocumentString } from "@/gql/graphql";
import { readSessionToken } from "@/lib/auth/cookies";
import { getClientIp } from "@/lib/client-ip";
import { executeGraphQL } from "./client";
import type { ApiResult } from "./types";

type Options<V> = {
  variables?: V;
  /**
   * Only for auth flows holding a token that is not yet in the cookie (a fresh login's token).
   * Everything else uses the session cookie.
   */
  token?: string | null;
};

/**
 * Shared, cached read for public data. Call it only inside a `"use cache"` function. It sends no
 * session and no client IP, and it THROWS on any failure, so Next never caches an outage or turns
 * it into a "not found".
 */
export async function cachedQuery<T, V>(
  document: TypedDocumentString<T, V>,
  options: Options<V> & { tags: string[] },
): Promise<T> {
  cacheLife("catalog");
  cacheTag(...options.tags);
  const { result } = await executeGraphQL(document, { variables: options.variables, retry: true });
  if (!result.ok) throw result.error;
  return result.data;
}

// Memoized for one request: the same query, variables and session run once.
const memoized = cache(
  async (query: string, variables: string, token: string | null, clientIp: string | null) => {
    // The document is passed as its string; the types are restored by sessionQuery.
    const { result } = await executeGraphQL(
      { toString: () => query } as TypedDocumentString<unknown, unknown>,
      { variables: variables ? JSON.parse(variables) : undefined, token, clientIp, retry: true },
    );
    return result;
  },
);

/** Per-shopper read (cart, checkout, orders, `me`). Sends the session; returns a result. */
export async function sessionQuery<T, V>(
  document: TypedDocumentString<T, V>,
  options: Options<V> = {},
): Promise<ApiResult<T>> {
  const token = await readSessionToken();
  const clientIp = await getClientIp();
  return (await memoized(
    document.toString(),
    JSON.stringify(options.variables ?? null),
    token,
    clientIp,
  )) as ApiResult<T>;
}

/** A write for Server Actions: session and client IP, never retried, never memoized. */
export async function mutate<T, V>(
  document: TypedDocumentString<T, V>,
  options: Options<V> = {},
): Promise<ApiResult<T>> {
  const { result } = await executeGraphQL(document, {
    variables: options.variables,
    token: options.token !== undefined ? options.token : await readSessionToken(),
    clientIp: await getClientIp(),
    retry: false,
  });
  return result;
}

/**
 * Like `mutate`, plus the response headers. Only `src/lib/auth/` login uses it (it needs the
 * `Set-Cookie` that carries the session token).
 */
export async function mutateWithResponse<T, V>(
  document: TypedDocumentString<T, V>,
  options: Options<V> = {},
): Promise<{ result: ApiResult<T>; headers: Headers | null }> {
  return executeGraphQL(document, {
    variables: options.variables,
    token: options.token !== undefined ? options.token : await readSessionToken(),
    clientIp: await getClientIp(),
    retry: false,
  });
}
