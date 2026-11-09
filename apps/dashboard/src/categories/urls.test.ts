import { describe, expect, it } from "vitest";

import { categoryListUrl, categoryPath, categoryUrl, parseCategoryListUrl } from "./urls";

describe("category urls", () => {
  it("builds the list URL with Saleor's trailing '?' and its params", () => {
    expect(categoryListUrl()).toBe("/categories/?");
    expect(categoryListUrl({ action: "create" })).toBe("/categories/?action=create");
    expect(categoryListUrl({ sort: "name", asc: true, query: "" })).toBe(
      "/categories/?sort=name&asc=true",
    );
    expect(categoryListUrl({ after: "abc=", asc: false })).toBe(
      "/categories/?after=abc%3D&asc=false",
    );
  });

  it("encodes the global ID in the detail URL", () => {
    expect(categoryPath("Q2F0ZWdvcnk6MQ==")).toBe("/categories/Q2F0ZWdvcnk6MQ==");
    expect(categoryUrl("Q2F0ZWdvcnk6MQ==")).toBe("/categories/Q2F0ZWdvcnk6MQ%3D%3D?");
    expect(categoryUrl("a", { action: "delete" })).toBe("/categories/a?action=delete");
  });

  it("parses the list params, round-tripping what it builds", () => {
    const params = { query: "boots", sort: "subcategories", asc: false, after: "c=" } as const;
    const url = new URL(categoryListUrl(params), "http://x");
    expect(parseCategoryListUrl(url.searchParams)).toEqual(params);
  });

  it("drops invalid values and prefers `after` over `before`", () => {
    expect(
      parseCategoryListUrl(
        new URLSearchParams("sort=price&asc=maybe&action=nuke&after=a&before=b&query="),
      ),
    ).toEqual({ after: "a" });
  });
});
