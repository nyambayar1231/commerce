import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "tok" }) }),
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.7" }),
}));

const { cachedQuery, mutate, sessionQuery } = await import("./access");
const doc = { toString: () => "query ShopInfo { shop { name } }" } as never;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

const ok = () => new Response(JSON.stringify({ data: { shop: { name: "A" } } }));
const headersOf = (call: number) =>
  (fetchMock.mock.calls[call] as [string, RequestInit])[1].headers as Record<string, string>;

describe("cachedQuery", () => {
  it("sets the catalog profile and tags, sends no session and no IP", async () => {
    fetchMock.mockResolvedValue(ok());
    const data = await cachedQuery(doc, { tags: ["shop", "x"] });
    expect(data).toEqual({ shop: { name: "A" } });
    expect(cacheLife).toHaveBeenCalledWith("catalog");
    expect(cacheTag).toHaveBeenCalledWith("shop", "x");
    expect(headersOf(0).authorization).toBeUndefined();
    expect(headersOf(0)["x-forwarded-for"]).toBeUndefined();
  });

  it("throws the ApiError so an outage is never cached", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(cachedQuery(doc, { tags: [] })).rejects.toMatchObject({
      name: "ApiError",
      kind: "http",
    });
  });
});

describe("sessionQuery and mutate", () => {
  it("sessionQuery sends the token (the IP only when TRUST_PROXY) and returns a result", async () => {
    fetchMock.mockResolvedValue(ok());
    const result = await sessionQuery(doc);
    expect(result.ok).toBe(true);
    expect(headersOf(0).authorization).toBe("Bearer tok");
    expect(headersOf(0)["x-forwarded-for"]).toBeUndefined(); // TRUST_PROXY is off in tests
  });

  it("sessionQuery returns { ok: false } instead of throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("down"));
    const result = await sessionQuery(doc, { variables: { unique: 1 } as never });
    expect(result.ok).toBe(false);
  });

  it("mutate is not retried", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    const result = await mutate(doc);
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
