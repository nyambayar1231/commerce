import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";

vi.mock("@/lib/api", () => ({ sessionQuery: vi.fn() }));

const { parseSearchPageParams, parseSearchQuery, searchProducts, SEARCH_QUERY_MAX } = await import(
  "./search"
);
const { sessionQuery } = vi.mocked(await import("@/lib/api"));

// Search `q` handling (ARCHITECTURE §10.7): trim, the 100-character cut, empty → no API call,
// and the page's cursors. `searchProducts` is pinned with a mocked `sessionQuery`.

function connection() {
  const node = {
    id: "p1",
    name: "Заazuur 603",
    slug: "zaazuur-603",
    category: null,
    small: null,
    large: null,
    minimalVariantPrice: { amount: 15000, currency: "MNT" },
    variants: [{ id: "v1", price: { amount: 15000 }, quantityAvailable: 3 }],
  };
  const edges = [{ cursor: "c0", node }];
  return {
    totalCount: 1,
    edges,
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
  };
}

beforeEach(() => {
  sessionQuery.mockReset();
});

describe("parseSearchQuery", () => {
  it("trims and keeps a real query", () => {
    expect(parseSearchQuery("  заazuur  ")).toBe("заazuur");
  });

  it("cuts a query to 100 characters", () => {
    const long = "а".repeat(150);
    expect(parseSearchQuery(long)).toBe("а".repeat(SEARCH_QUERY_MAX));
    expect(SEARCH_QUERY_MAX).toBe(100);
  });

  it("takes the first of repeated values", () => {
    expect(parseSearchQuery(["нэг", "хоёр"])).toBe("нэг");
  });

  it("is null for an absent, empty or whitespace-only query", () => {
    expect(parseSearchQuery(undefined)).toBeNull();
    expect(parseSearchQuery("")).toBeNull();
    expect(parseSearchQuery("   ")).toBeNull();
    expect(parseSearchQuery(["", "хоёр"])).toBeNull();
  });
});

describe("parseSearchPageParams", () => {
  it("keeps an after cursor and drops before", () => {
    expect(parseSearchPageParams({ q: "заazuur", after: "Y3Vyc29y", before: "b3RoZXI" })).toEqual({
      q: "заazuur",
      after: "Y3Vyc29y",
    });
  });

  it("keeps before only without after, and drops over-long cursors", () => {
    expect(parseSearchPageParams({ q: "x", before: "Y3Vyc29y" })).toEqual({
      q: "x",
      before: "Y3Vyc29y",
    });
    expect(parseSearchPageParams({ q: "x", before: " ".repeat(201) })).toEqual({ q: "x" });
  });
});

describe("searchProducts", () => {
  it("queries forward by default and maps the connection", async () => {
    sessionQuery.mockResolvedValue({ ok: true, data: { products: connection() } });
    const listing = await searchProducts("заazuur");
    expect(sessionQuery).toHaveBeenCalledWith(expect.anything(), {
      variables: { q: "заazuur", first: 24 },
    });
    expect(listing.items).toEqual([
      expect.objectContaining({
        id: "p1",
        name: "Заazuur 603",
        href: "/products/zaazuur-603",
        price: "₮\u00a015,000",
      }),
    ]);
  });

  it("pages backwards with last/before", async () => {
    sessionQuery.mockResolvedValue({ ok: true, data: { products: connection() } });
    await searchProducts("x", undefined, "Y3Vyc29y");
    expect(sessionQuery).toHaveBeenCalledWith(expect.anything(), {
      variables: { q: "x", last: 24, before: "Y3Vyc29y" },
    });
  });

  it("throws on an API failure, never a fake 'no results'", async () => {
    const error = new ApiError({ kind: "network", operation: "ProductSearch", requestId: "r1" });
    sessionQuery.mockResolvedValue({ ok: false, error });
    await expect(searchProducts("x")).rejects.toBe(error);
  });
});
