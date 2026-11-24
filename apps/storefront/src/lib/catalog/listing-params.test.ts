import { describe, expect, it } from "vitest";
import {
  listingHref,
  listingSearchParams,
  paginationHrefs,
  parseListingParams,
} from "./listing-params";

// The listing URL rules (ARCHITECTURE §10.7): every parse rule and every URL the pages build.

describe("parseListingParams", () => {
  it("defaults the sort to newest", () => {
    expect(parseListingParams({}).sort).toBe("newest");
    expect(parseListingParams({ sort: "featured" }).sort).toBe("newest");
    expect(parseListingParams({ sort: "" }).sort).toBe("newest");
  });

  it("accepts the four sorts", () => {
    for (const sort of ["newest", "price-asc", "price-desc", "name-asc"] as const) {
      expect(parseListingParams({ sort }).sort).toBe(sort);
    }
  });

  it("uses the first of repeated params", () => {
    expect(parseListingParams({ sort: ["x", "price-asc"] }).sort).toBe("newest");
    expect(parseListingParams({ category: ["gutal", "deel"] }).category).toBe("gutal");
    expect(parseListingParams({ minPrice: ["100", "200"] }).minPrice).toBe(100);
  });

  it("parses whole-number prices", () => {
    expect(parseListingParams({ minPrice: "100" }).minPrice).toBe(100);
    expect(parseListingParams({ minPrice: "0" }).minPrice).toBe(0);
    expect(parseListingParams({ maxPrice: "1000000000" }).maxPrice).toBe(1_000_000_000);
  });

  it("drops prices that are not whole numbers in range", () => {
    for (const minPrice of ["-5", "12.5", "1e3", "+7", "1000000001", "", "5 "]) {
      expect(parseListingParams({ minPrice })).not.toHaveProperty("minPrice");
    }
  });

  it("swaps a min above max", () => {
    const params = parseListingParams({ minPrice: "900", maxPrice: "100" });
    expect(params).toEqual({ sort: "newest", minPrice: 100, maxPrice: 900 });
  });

  it("keeps a valid slug filter and drops an invalid one", () => {
    expect(parseListingParams({ category: "gutal" }).category).toBe("gutal");
    expect(parseListingParams({ collection: "summer-sale-2026" }).collection).toBe(
      "summer-sale-2026",
    );
    for (const category of ["Gutal", "gutal-", "-gutal", "gut al", "", "x".repeat(256)]) {
      expect(parseListingParams({ category })).not.toHaveProperty("category");
    }
  });

  it("keeps cursors up to 200 characters and drops longer or empty ones", () => {
    const cursor = "x".repeat(200);
    expect(parseListingParams({ after: cursor }).after).toBe(cursor);
    expect(parseListingParams({ after: "x".repeat(201) })).not.toHaveProperty("after");
    expect(parseListingParams({ before: "" })).not.toHaveProperty("before");
  });

  it("lets after win over before", () => {
    const params = parseListingParams({ after: "a-cursor", before: "b-cursor" });
    expect(params.after).toBe("a-cursor");
    expect(params).not.toHaveProperty("before");
  });
});

describe("listingSearchParams", () => {
  const base = parseListingParams({
    sort: "price-asc",
    category: "gutal",
    minPrice: "100",
    maxPrice: "900",
  });

  it("is empty for the default listing and omits the default sort", () => {
    expect(listingSearchParams(parseListingParams({}))).toBe("");
    expect(listingSearchParams(parseListingParams({ sort: "newest" }))).toBe("");
  });

  it("keeps the filters", () => {
    expect(listingSearchParams(base)).toBe(
      "sort=price-asc&category=gutal&minPrice=100&maxPrice=900",
    );
  });

  it("keeps cursors untouched when nothing changes", () => {
    const withCursor = { ...base, after: "a-cursor" };
    expect(listingSearchParams(withCursor)).toBe(
      "sort=price-asc&category=gutal&minPrice=100&maxPrice=900&after=a-cursor",
    );
  });

  it("drops the cursors when a filter or the sort changes", () => {
    const withCursor = { ...base, after: "a-cursor", before: undefined };
    for (const overrides of [
      { sort: "name-asc" as const },
      { minPrice: 50 },
      { maxPrice: undefined },
      { category: undefined as string | undefined },
      { collection: "deel" },
    ]) {
      expect(listingSearchParams(withCursor, overrides)).not.toContain("after=");
    }
  });

  it("keeps the other params when only a cursor changes, replacing the other cursor", () => {
    const withAfter = { ...base, after: "a-cursor" };
    expect(listingSearchParams(withAfter, { before: "b-cursor" })).toBe(
      "sort=price-asc&category=gutal&minPrice=100&maxPrice=900&before=b-cursor",
    );
    const withBefore = { ...base, before: "b-cursor" };
    expect(listingSearchParams(withBefore, { after: "c-cursor" })).toBe(
      "sort=price-asc&category=gutal&minPrice=100&maxPrice=900&after=c-cursor",
    );
  });

  it("removes a filter passed as undefined", () => {
    expect(listingSearchParams(base, { category: undefined, minPrice: undefined })).toBe(
      "sort=price-asc&maxPrice=900",
    );
  });
});

describe("listingHref", () => {
  it("appends the query when there is one and not otherwise", () => {
    expect(listingHref("/products", parseListingParams({}))).toBe("/products");
    expect(listingHref("/products", parseListingParams({ sort: "name-asc" }))).toBe(
      "/products?sort=name-asc",
    );
  });
});

describe("paginationHrefs", () => {
  it("builds before/after links that keep the filters and the sort", () => {
    const params = parseListingParams({ sort: "price-desc", category: "gutal", after: "stale" });
    const { previousHref, nextHref } = paginationHrefs("/products", params, {
      hasNextPage: true,
      hasPreviousPage: true,
      startCursor: "start-cursor",
      endCursor: "end-cursor",
    });
    expect(previousHref).toBe("/products?sort=price-desc&category=gutal&before=start-cursor");
    expect(nextHref).toBe("/products?sort=price-desc&category=gutal&after=end-cursor");
  });

  it("returns null for a direction with no page behind it", () => {
    const { previousHref, nextHref } = paginationHrefs("/products", parseListingParams({}), {
      hasNextPage: false,
      hasPreviousPage: true,
      startCursor: "start-cursor",
      endCursor: null,
    });
    expect(previousHref).toBe("/products?before=start-cursor");
    expect(nextHref).toBeNull();
  });

  it("returns two nulls for a single page, even without cursors", () => {
    expect(
      paginationHrefs("/products", parseListingParams({}), {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      }),
    ).toEqual({ previousHref: null, nextHref: null });
  });
});
