import { describe, expect, it } from "vitest";
import {
  buildFilterBarView,
  categoryHref,
  collectionHref,
  isPriceRangeSelected,
  PRICE_RANGES,
  priceHref,
  sortHref,
} from "./filter-bar-view";
import type { FilterOptionsView, ListingParams } from "./types";

const BASE = "/products";
const params: ListingParams = {
  sort: "price-asc",
  category: "shoes",
  collection: "summer",
  minPrice: 50_000,
  maxPrice: 100_000,
  after: "cursor1",
};

describe("filter bar links", () => {
  it("selects a category, keeping the other filters and sort, dropping the cursor", () => {
    const url = new URL(categoryHref(BASE, params, "bags"), "http://x");
    expect(url.pathname).toBe("/products");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sort: "price-asc",
      category: "bags",
      collection: "summer",
      minPrice: "50000",
      maxPrice: "100000",
    });
  });

  it("clears the category only", () => {
    const url = new URL(categoryHref(BASE, params, undefined), "http://x");
    expect(url.searchParams.has("category")).toBe(false);
    expect(url.searchParams.get("collection")).toBe("summer");
    expect(url.searchParams.has("after")).toBe(false);
  });

  it("selects and clears a collection", () => {
    expect(
      new URL(collectionHref(BASE, params, "winter"), "http://x").searchParams.get("collection"),
    ).toBe("winter");
    const cleared = new URL(collectionHref(BASE, params, undefined), "http://x");
    expect(cleared.searchParams.has("collection")).toBe(false);
    expect(cleared.searchParams.get("category")).toBe("shoes");
  });

  it("maps each price preset to minPrice/maxPrice", () => {
    const bare: ListingParams = { sort: "newest" };
    expect(priceHref(BASE, bare, PRICE_RANGES[0] ?? null)).toBe("/products?maxPrice=50000");
    expect(priceHref(BASE, bare, PRICE_RANGES[1] ?? null)).toBe(
      "/products?minPrice=50000&maxPrice=100000",
    );
    expect(priceHref(BASE, bare, PRICE_RANGES[2] ?? null)).toBe(
      "/products?minPrice=100000&maxPrice=200000",
    );
    expect(priceHref(BASE, bare, PRICE_RANGES[3] ?? null)).toBe("/products?minPrice=200000");
  });

  it("replaces both ends when switching range, and 'all prices' clears both", () => {
    const open = new URL(priceHref(BASE, params, { min: 200_000 }), "http://x");
    expect(open.searchParams.get("minPrice")).toBe("200000");
    expect(open.searchParams.has("maxPrice")).toBe(false);
    const cleared = new URL(priceHref(BASE, params, null), "http://x");
    expect(cleared.searchParams.has("minPrice")).toBe(false);
    expect(cleared.searchParams.has("maxPrice")).toBe(false);
    expect(cleared.searchParams.get("category")).toBe("shoes");
  });

  it("changes the sort and omits the default one", () => {
    expect(new URL(sortHref(BASE, params, "name-asc"), "http://x").searchParams.get("sort")).toBe(
      "name-asc",
    );
    expect(sortHref(BASE, { sort: "price-asc" }, "newest")).toBe("/products");
  });

  it("knows which preset the URL selects", () => {
    expect(isPriceRangeSelected(params, { min: 50_000, max: 100_000 })).toBe(true);
    expect(isPriceRangeSelected(params, { min: 50_000 })).toBe(false);
    expect(isPriceRangeSelected({ sort: "newest", minPrice: 7 }, PRICE_RANGES[0] ?? {})).toBe(
      false,
    );
  });
});

describe("buildFilterBarView", () => {
  const options: FilterOptionsView = {
    categories: [{ name: "Shoes", slug: "shoes", level: 0 }],
    collections: [{ name: "Summer", slug: "summer" }],
  };

  it("lists category, collection and price, and leaves the hidden group out", () => {
    const ids = (hide: "category" | "collection" | null) =>
      buildFilterBarView(BASE, { sort: "newest" }, options, hide).groups.map((g) => g.id);
    expect(ids(null)).toEqual(["category", "collection", "price"]);
    expect(ids("category")).toEqual(["collection", "price"]);
    expect(ids("collection")).toEqual(["category", "price"]);
  });

  it("marks the selected options and counts one per set filter", () => {
    const view = buildFilterBarView(BASE, params, options, null);
    const category = view.groups.find((g) => g.id === "category");
    expect(category?.count).toBe(1);
    expect(category?.choices.find((c) => c.selected)?.key).toBe("shoes");
    const price = view.groups.find((g) => g.id === "price");
    expect(price?.count).toBe(1);
    expect(price?.customPrice).toBeUndefined();
    expect(price?.choices.find((c) => c.selected)?.key).toBe("50000-100000");
    expect(view.sortChoices.find((s) => s.selected)?.sort).toBe("price-asc");
  });

  it("treats an unknown slug as unselected and shows a hand-typed price as custom", () => {
    const view = buildFilterBarView(
      BASE,
      { sort: "newest", category: "gone", minPrice: 123, maxPrice: 456 },
      options,
      null,
    );
    expect(view.groups.find((g) => g.id === "category")?.count).toBe(0);
    const price = view.groups.find((g) => g.id === "price");
    expect(price?.count).toBe(1);
    expect(price?.customPrice?.min).toContain("123");
    expect(price?.customPrice?.max).toContain("456");
    expect(price?.choices.some((c) => c.selected)).toBe(false);
  });

  it("changes its key with the URL state", () => {
    const a = buildFilterBarView(BASE, { sort: "newest" }, options, null).key;
    const b = buildFilterBarView(BASE, { sort: "newest", category: "shoes" }, options, null).key;
    expect(a).not.toBe(b);
  });
});
