import "server-only";

import type { TypedDocumentString } from "@/gql/graphql";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { ApiError, type ApiResult } from "./types";

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 200;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

export type ExecuteOptions<V> = {
  variables?: V;
  token?: string | null;
  clientIp?: string | null;
  /** Queries only: one retry on a network error or HTTP 502/503/504. */
  retry?: boolean;
};

type GraphQLBody = {
  data?: unknown;
  errors?: { message?: string; extensions?: { code?: unknown } }[];
};

function operationName(document: string): string {
  return /\b(?:query|mutation)\s+([A-Za-z_]\w*)/.exec(document)?.[1] ?? "anonymous";
}

function codesOf(body: GraphQLBody | null): string[] {
  const codes: string[] = [];
  for (const error of body?.errors ?? []) {
    const code = error?.extensions?.code;
    if (typeof code === "string") codes.push(code);
  }
  return codes;
}

type Attempt =
  | { outcome: "response"; status: number; body: GraphQLBody | null; headers: Headers }
  | { outcome: "failure"; kind: "network" | "timeout" };

async function attempt(
  document: string,
  name: string,
  requestId: string,
  variables: unknown,
  token: string | null | undefined,
  clientIp: string | null | undefined,
): Promise<Attempt> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "x-graphql-yoga-csrf": "1",
    "x-request-id": requestId,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (clientIp) headers["x-forwarded-for"] = clientIp;

  try {
    const response = await fetch(`${getEnv().apiUrl}/graphql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: document, variables, operationName: name }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let body: GraphQLBody | null = null;
    try {
      body = (await response.json()) as GraphQLBody;
    } catch {
      body = null; // not JSON (a proxy's error page, an empty body)
    }
    return { outcome: "response", status: response.status, body, headers: response.headers };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return { outcome: "failure", kind: timedOut ? "timeout" : "network" };
  }
}

/**
 * The one place that sends a request to the API (ARCHITECTURE §10.5). Never throws: failures come
 * back as `{ ok: false, error }` and are logged once, without variables, tokens or bodies.
 */
export async function executeGraphQL<T, V>(
  document: TypedDocumentString<T, V>,
  options: ExecuteOptions<V> = {},
): Promise<{ result: ApiResult<T>; headers: Headers | null }> {
  const query = document.toString();
  const name = operationName(query);
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const send = () =>
    attempt(query, name, requestId, options.variables, options.token, options.clientIp);

  let first = await send();
  const retryable =
    first.outcome === "failure" ? first.kind === "network" : RETRYABLE_STATUS.has(first.status);
  if (options.retry && retryable) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    first = await send();
  }

  const fail = (error: ApiError, headers: Headers | null) => {
    log.warn("api-error", {
      operation: name,
      kind: error.kind,
      status: error.status,
      codes: error.codes,
      durationMs: Date.now() - started,
      requestId,
    });
    return { result: { ok: false, error } satisfies ApiResult<T>, headers };
  };

  if (first.outcome === "failure") {
    return fail(new ApiError({ kind: first.kind, operation: name, requestId }), null);
  }

  const { status, body, headers } = first;
  const codes = codesOf(body);
  if (status < 200 || status >= 300) {
    return fail(new ApiError({ kind: "http", operation: name, requestId, status, codes }), headers);
  }
  if (body === null || (body.errors?.length ?? 0) > 0 || body.data == null) {
    // Any `errors` entry is a failure, even next to partial data (so nothing partial is cached).
    return fail(
      new ApiError({ kind: "graphql", operation: name, requestId, status, codes }),
      headers,
    );
  }
  return { result: { ok: true, data: body.data as T }, headers };
}
