import { describe, expect, it } from "vitest";

import {
  pageCreatePath,
  pageListUrl,
  pagePath,
  pageUrl,
  parsePageListUrl,
  parsePageUrl,
} from "./urls";

describe("page urls", () => {
  it("builds the list URL with Saleor's trailing '?' and its params", () => {
    expect(pageListUrl()).toBe("/models/?");
    expect(pageListUrl({ sort: "title", asc: true, query: "" })).toBe(
      "/models/?sort=title&asc=true",
    );
    expect(pageListUrl({ query: "about", sort: "visible", asc: false })).toBe(
      "/models/?query=about&sort=visible&asc=false",
    );
    expect(pageListUrl({ after: "abc=", asc: false })).toBe("/models/?after=abc%3D&asc=false");
  });

  it("serialises the bulk-selection ids comma-separated (Saleor's qs uses indexed keys)", () => {
    expect(pageListUrl({ action: "remove", ids: ["a", "b"] })).toBe(
      "/models/?action=remove&ids=a%2Cb",
    );
    expect(pageListUrl({ action: "remove", ids: [] })).toBe("/models/?action=remove");
  });

  it("builds the create path and the encoded detail URL", () => {
    expect(pageCreatePath).toBe("/models/add");
    expect(pagePath("UGFnZTox")).toBe("/models/UGFnZTox");
    expect(pageUrl("UGFnZTox")).toBe("/models/UGFnZTox?");
    expect(pageUrl("a", { action: "remove" })).toBe("/models/a?action=remove");
  });

  it("parses the list params, round-tripping what it builds", () => {
    const params = {
      query: "about",
      sort: "slug",
      asc: false,
      after: "c=",
    } as const;
    const url = new URL(pageListUrl(params), "http://x");

    expect(parsePageListUrl(url.searchParams)).toEqual(params);

    const withIds = { action: "remove", ids: ["a", "b"] } as const;
    const idsUrl = new URL(pageListUrl({ ...withIds, ids: [...withIds.ids] }), "http://x");

    expect(parsePageListUrl(idsUrl.searchParams)).toEqual(withIds);
  });

  it("drops invalid values and prefers `after` over `before`", () => {
    expect(
      parsePageListUrl(
        new URLSearchParams("sort=price&asc=maybe&action=nuke&after=a&before=b&query="),
      ),
    ).toEqual({ after: "a" });
  });
});

describe("page detail urls", () => {
  it("builds the detail URL with the open dialog", () => {
    expect(pageUrl("a", { action: "remove" })).toBe("/models/a?action=remove");
  });

  it("parses the detail params, round-tripping what it builds", () => {
    const url = new URL(pageUrl("a", { action: "remove" }), "http://x");

    expect(parsePageUrl(url.searchParams)).toEqual({ action: "remove" });
  });

  it("drops a dialog the page doesn't know", () => {
    expect(parsePageUrl(new URLSearchParams("action=nuke"))).toEqual({});
    expect(parsePageUrl(new URLSearchParams(""))).toEqual({});
  });
});
