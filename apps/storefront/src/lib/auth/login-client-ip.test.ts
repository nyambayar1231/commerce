import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ARCHITECTURE §10.2: with TRUST_PROXY=true the login request carries the LAST X-Forwarded-For
// entry (the one our proxy added) as the only entry, so the API throttles each shopper alone.
process.env.TRUST_PROXY = "true";
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.7" }),
}));

const { mutateWithResponse } = await import("@/lib/api/access");
const doc = { toString: () => "mutation TokenCreate { x }" } as never;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { x: 1 } })));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterEach(() => vi.unstubAllGlobals());

describe("login request", () => {
  it("sends the last forwarded entry, not the client-forged first one", async () => {
    await mutateWithResponse(doc);
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers["x-forwarded-for"]).toBe("198.51.100.7");
  });
  it("sends an explicit token over the cookie's (auth flows only)", async () => {
    await mutateWithResponse(doc, { token: "fresh" });
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers.authorization).toBe("Bearer fresh");
  });
});
