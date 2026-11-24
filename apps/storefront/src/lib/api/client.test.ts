import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "./client";

const doc = {
  toString: () => "query ShopInfo { shop { name } }",
} as unknown as Parameters<typeof executeGraphQL>[0];
const mutation = {
  toString: () => "mutation Login($p: String!) { x(p: $p) }",
} as unknown as Parameters<typeof executeGraphQL>[0];

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

let fetchMock: ReturnType<typeof vi.fn>;
let stdout: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("request", () => {
  it("posts the document with the fixed headers and no token or IP by default", async () => {
    fetchMock.mockResolvedValue(json({ data: { shop: { name: "A" } } }));
    const { result } = await executeGraphQL(doc, { variables: { a: 1 } });
    expect(result).toEqual({ ok: true, data: { shop: { name: "A" } } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/graphql");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.accept).toBe("application/json");
    expect(headers["x-graphql-yoga-csrf"]).toBe("1");
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.authorization).toBeUndefined();
    expect(headers["x-forwarded-for"]).toBeUndefined();
    expect(JSON.parse(init.body as string)).toEqual({
      query: "query ShopInfo { shop { name } }",
      variables: { a: 1 },
      operationName: "ShopInfo",
    });
  });

  it("sends Bearer and X-Forwarded-For when given", async () => {
    fetchMock.mockResolvedValue(json({ data: {} }));
    await executeGraphQL(doc, { token: "tok", clientIp: "203.0.113.9" });
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers.authorization).toBe("Bearer tok");
    expect(headers["x-forwarded-for"]).toBe("203.0.113.9");
  });

  it("returns the response headers", async () => {
    fetchMock.mockResolvedValue(json({ data: {} }, 200, { "set-cookie": "session=x" }));
    const { headers } = await executeGraphQL(doc);
    expect(headers?.get("set-cookie")).toBe("session=x");
  });
});

describe("failures", () => {
  it("treats errors as a graphql failure with codes, with and without data", async () => {
    const errors = [{ message: "m", extensions: { code: "FORBIDDEN" } }, { message: "n" }];
    fetchMock.mockResolvedValueOnce(json({ errors }));
    const a = await executeGraphQL(doc);
    fetchMock.mockResolvedValueOnce(json({ data: { shop: { name: "A" } }, errors }));
    const b = await executeGraphQL(doc);
    for (const { result } of [a, b]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("graphql");
        expect(result.error.codes).toEqual(["FORBIDDEN"]);
        expect(result.error.operation).toBe("ShopInfo");
      }
    }
  });

  it("maps HTTP 500 to http, reading GraphQL errors from a JSON body", async () => {
    fetchMock.mockResolvedValue(json({ errors: [{ extensions: { code: "BOOM" } }] }, 500));
    const { result } = await executeGraphQL(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("http");
      expect(result.error.status).toBe(500);
      expect(result.error.codes).toEqual(["BOOM"]);
    }
  });

  it("maps a network error to network and a timeout to timeout", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const a = await executeGraphQL(doc);
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    const b = await executeGraphQL(doc);
    expect(a.result.ok === false && a.result.error.kind).toBe("network");
    expect(b.result.ok === false && b.result.error.kind).toBe("timeout");
  });

  it("logs one line per failure, without variables or tokens", async () => {
    fetchMock.mockResolvedValue(json({ errors: [{ extensions: { code: "X" } }] }));
    await executeGraphQL(mutation, { variables: { p: "hunter2" }, token: "secret-token" });
    expect(stdout).toHaveBeenCalledTimes(1);
    const line = String(stdout.mock.calls[0]?.[0]);
    const entry = JSON.parse(line);
    expect(entry).toMatchObject({ event: "api-error", operation: "Login", kind: "graphql" });
    expect(entry.codes).toEqual(["X"]);
    expect(entry.requestId).toBeTypeOf("string");
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("secret-token");
  });
});

describe("retry", () => {
  it("retries a query once on 503, then succeeds", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ data: { ok: 1 } }));
    const { result } = await executeGraphQL(doc, { retry: true });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries only once", async () => {
    fetchMock.mockResolvedValue(json({}, 502));
    const { result } = await executeGraphQL(doc, { retry: true });
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries without retry (mutations)", async () => {
    fetchMock.mockResolvedValue(json({}, 503));
    await executeGraphQL(mutation, { retry: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry HTTP 500 or a timeout", async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    await executeGraphQL(doc, { retry: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new DOMException("t", "TimeoutError"));
    await executeGraphQL(doc, { retry: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
