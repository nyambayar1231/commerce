import { describe, expect, it } from "vitest";

import { parseFilterContainer } from "../components/ConditionalFilter/ValueProvider/TokenArray";
import {
  getFiltersUrlParams,
  parseProductListUrl,
  productListUrl,
  productPath,
  productUrl,
} from "./urls";

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

  it("keeps the conditional filters next to search, sort and pagination", () => {
    const filters = parseFilterContainer("0[s0.isPublished]=false");

    expect(productListUrl({ filters, sort: "name", asc: true })).toBe(
      "/products/?0%5Bs0.isPublished%5D=false&sort=name&asc=true",
    );
  });

  it("parses a pasted filter URL into the filter model", () => {
    const params = parseProductListUrl(
      new URLSearchParams("0[s0.isPublished]=false&sort=name&asc=true&query=boots"),
    );

    expect(params.query).toBe("boots");
    expect(params.sort).toBe("name");
    expect(params.asc).toBe(true);
    expect(params.filters?.filter((entry) => typeof entry !== "string")).toHaveLength(1);
  });

  it("round-trips Saleor's filter URL format", () => {
    const filters = "0[s0.price]=100&1=AND&2[s2.category][0]=cat-1&2[s2.category][1]=cat-2";

    expect(productListUrl(parseProductListUrl(new URLSearchParams(filters)))).toBe(
      `/products/?${new URLSearchParams(filters).toString()}`,
    );
  });

  it("ignores invalid filter entries", () => {
    expect(
      parseProductListUrl(
        new URLSearchParams("0[s0.isPublished]=maybe&1[s0.price]=abc&2[s0.channel]=x&sort=name"),
      ),
    ).toEqual({ sort: "name" });
  });

  it("resets the page cursor when the filters change", () => {
    const filters = parseFilterContainer("0[s0.isPublished]=false");

    expect(getFiltersUrlParams({ sort: "name", asc: true, after: "a" }, filters)).toEqual({
      sort: "name",
      asc: true,
      after: undefined,
      before: undefined,
      filters,
    });
  });
});
