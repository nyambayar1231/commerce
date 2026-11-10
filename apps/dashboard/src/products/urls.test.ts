import { describe, expect, it } from "vitest";

import { parseProductListUrl, productListUrl, productPath, productUrl } from "./urls";

describe("product urls", () => {
  it("builds the list URL with Saleor's trailing '?' and its params", () => {
    expect(productListUrl()).toBe("/products/?");
    expect(productListUrl({ sort: "name", asc: true, query: "" })).toBe(
      "/products/?sort=name&asc=true",
    );
    expect(productListUrl({ after: "abc=", asc: false })).toBe("/products/?after=abc%3D&asc=false");
  });

  it("encodes the global ID in the detail URL", () => {
    expect(productPath("UHJvZHVjdDox")).toBe("/products/UHJvZHVjdDox");
    expect(productUrl("UHJvZHVjdDox")).toBe("/products/UHJvZHVjdDox?");
    expect(productUrl("a=")).toBe("/products/a%3D?");
  });

  it("parses the list params, round-tripping what it builds", () => {
    const params = { query: "boots", sort: "price", asc: false, before: "c=" } as const;
    const url = new URL(productListUrl(params), "http://x");
    expect(parseProductListUrl(url.searchParams)).toEqual(params);
  });

  it("drops invalid values and prefers `after` over `before`", () => {
    expect(
      parseProductListUrl(
        new URLSearchParams("sort=productType&asc=maybe&after=a&before=b&query="),
      ),
    ).toEqual({ after: "a" });
  });
});
