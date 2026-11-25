import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionQuery = vi.fn();
vi.mock("@/lib/api", async () => ({
  sessionQuery,
  ApiError: (await vi.importActual<typeof import("@/lib/api/types")>("@/lib/api/types")).ApiError,
}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));

const { getAccountOrder, getAccountOverview, getOrdersPage, ORDERS_PER_PAGE } = await import(
  "./loaders"
);
const { ApiError } = await import("@/lib/api/types");

const signedIn = { status: "authenticated", user: {} };
const ok = <T>(data: T) => ({ ok: true as const, data });

beforeEach(() => {
  sessionQuery.mockReset();
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue(signedIn);
});

describe("loaders for a guest", () => {
  it("never reach the API and fail as signed out (not as a 404)", async () => {
    getCurrentUser.mockResolvedValue({ status: "guest" });
    for (const result of [
      await getAccountOverview(),
      await getOrdersPage({}),
      await getAccountOrder("T3JkZXI6MQ=="),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("http");
    }
    expect(sessionQuery).not.toHaveBeenCalled();
  });
});

describe("getOrdersPage", () => {
  const page = (hasPrevious: boolean, hasNext: boolean) =>
    ok({
      me: {
        orders: {
          edges: [],
          pageInfo: {
            hasPreviousPage: hasPrevious,
            hasNextPage: hasNext,
            startCursor: "s",
            endCursor: "e",
          },
        },
      },
    });

  it("goes forward with first/after and back with last/before", async () => {
    sessionQuery.mockResolvedValue(page(false, true));
    await getOrdersPage({ after: "c1" });
    expect(sessionQuery.mock.calls[0]?.[1].variables).toEqual({
      first: ORDERS_PER_PAGE,
      after: "c1",
    });
    await getOrdersPage({ before: "c2" });
    expect(sessionQuery.mock.calls[1]?.[1].variables).toEqual({
      last: ORDERS_PER_PAGE,
      before: "c2",
    });
  });

  it("offers a cursor only for a direction that has a page", async () => {
    sessionQuery.mockResolvedValue(page(false, true));
    const result = await getOrdersPage({});
    expect(result.ok && result.data).toMatchObject({ previousCursor: null, nextCursor: "e" });
  });
});

describe("getAccountOrder", () => {
  it("passes the API's refusal on as a graphql error (the page answers 404)", async () => {
    const refused = new ApiError({ kind: "graphql", operation: "AccountOrder", requestId: "r" });
    sessionQuery.mockResolvedValue({ ok: false, error: refused });
    const result = await getAccountOrder("other-customers-order");
    expect(!result.ok && result.error.kind).toBe("graphql");
  });

  it("an order the API returns as null is data null (also a 404)", async () => {
    sessionQuery.mockResolvedValue(ok({ order: null }));
    const result = await getAccountOrder("unknown");
    expect(result).toEqual({ ok: true, data: null });
  });
});
