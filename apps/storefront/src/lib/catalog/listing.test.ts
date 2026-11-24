import { describe, expect, it, vi } from "vitest";

// `listing.ts` pulls in the server kernel; only the pure sort and where mapping is tested here,
// so the request-time modules are stubbed the same way `access.test.ts` stubs them.
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/cache", () => ({ cacheLife: () => undefined, cacheTag: () => undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { listingWhereInput, sortInput } = await import("./listing");

describe("sortInput", () => {
  it("maps the four sorts to the API's ProductOrder", () => {
    expect(sortInput("newest")).toEqual({ field: "CREATED_AT", direction: "DESC" });
    expect(sortInput("price-asc")).toEqual({ field: "PRICE", direction: "ASC" });
    expect(sortInput("price-desc")).toEqual({ field: "PRICE", direction: "DESC" });
    expect(sortInput("name-asc")).toEqual({ field: "NAME", direction: "ASC" });
  });
});

describe("listingWhereInput", () => {
  const all = { scope: { kind: "all" } as const, categoryId: null, collectionId: null };

  it("has no condition without filters, so every product matches", () => {
    expect(listingWhereInput(all)).toBeUndefined();
  });

  it("scopes a category page to the route's category (the API includes its descendants)", () => {
    expect(
      listingWhereInput({
        ...all,
        scope: { kind: "category", id: "Q2F0ZWdvcnk6MQ", slug: "gutal" },
      }),
    ).toEqual({ category: { eq: "Q2F0ZWdvcnk6MQ" } });
  });

  it("scopes a collection page to the route's collection", () => {
    expect(
      listingWhereInput({
        ...all,
        scope: { kind: "collection", id: "Q29sbGVjdGlvbjox", slug: "shine-baraa" },
      }),
    ).toEqual({ collection: { eq: "Q29sbGVjdGlvbjox" } });
  });

  it("resolves the filter slugs to ids and combines both filters", () => {
    expect(listingWhereInput({ ...all, categoryId: "Q2F0ZWdvcnk6MQ" })).toEqual({
      category: { eq: "Q2F0ZWdvcnk6MQ" },
    });
    expect(
      listingWhereInput({ ...all, categoryId: "Q2F0ZWdvcnk6MQ", collectionId: "Q29sbGVjdGlvbjox" }),
    ).toEqual({ category: { eq: "Q2F0ZWdvcnk6MQ" }, collection: { eq: "Q29sbGVjdGlvbjox" } });
  });

  it("ignores an unknown filter slug (a null id adds no condition)", () => {
    expect(listingWhereInput({ ...all, categoryId: null, collectionId: null })).toBeUndefined();
  });

  it("lets the route's scope win over the same-kind URL filter", () => {
    expect(
      listingWhereInput({
        scope: { kind: "category", id: "Q2F0ZWdvcnk6MQ", slug: "gutal" },
        categoryId: "Q2F0ZWdvcnk6Mg",
        collectionId: null,
      }),
    ).toEqual({ category: { eq: "Q2F0ZWdvcnk6MQ" } });
  });

  it("filters by the minimal variant price, open at either end", () => {
    expect(listingWhereInput({ ...all, minPrice: 1000, maxPrice: 9000 })).toEqual({
      minimalPrice: { range: { gte: 1000, lte: 9000 } },
    });
    expect(listingWhereInput({ ...all, minPrice: 1000 })).toEqual({
      minimalPrice: { range: { gte: 1000, lte: undefined } },
    });
    expect(listingWhereInput({ ...all, maxPrice: 9000 })).toEqual({
      minimalPrice: { range: { gte: undefined, lte: 9000 } },
    });
  });
});
