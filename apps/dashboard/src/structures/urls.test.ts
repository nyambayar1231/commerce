import { describe, expect, it } from "vitest";

import {
  menuListUrl,
  menuPath,
  menuUrl,
  parseMenuListUrl,
  parseMenuUrl,
  structuresListPath,
} from "./urls";

describe("structures urls", () => {
  it("builds the list URL with Saleor's trailing '?' and its params", () => {
    expect(structuresListPath).toBe("/structures/");
    expect(menuListUrl()).toBe("/structures/?");
    expect(menuListUrl({ sort: "name", asc: true, query: "" })).toBe(
      "/structures/?sort=name&asc=true",
    );
    expect(menuListUrl({ query: "main", sort: "items", asc: false })).toBe(
      "/structures/?query=main&sort=items&asc=false",
    );
    expect(menuListUrl({ after: "abc=", asc: false })).toBe("/structures/?after=abc%3D&asc=false");
  });

  it("serialises the bulk-selection ids comma-separated", () => {
    expect(menuListUrl({ action: "remove-many", ids: ["a", "b"] })).toBe(
      "/structures/?action=remove-many&ids=a%2Cb",
    );
    expect(menuListUrl({ action: "remove-many", ids: [] })).toBe("/structures/?action=remove-many");
  });

  it("builds the detail URL with the open dialog and the edited item", () => {
    expect(menuPath("a")).toBe("/structures/a");
    expect(menuUrl("UGFnZTox")).toBe("/structures/UGFnZTox?");
    expect(menuUrl("a", { action: "add-item" })).toBe("/structures/a?action=add-item");
    expect(menuUrl("a", { action: "edit-item", id: "b" })).toBe(
      "/structures/a?action=edit-item&id=b",
    );
  });

  it("parses the list params, round-tripping what it builds", () => {
    const params = {
      query: "main",
      sort: "items",
      asc: false,
      after: "c=",
      action: "remove",
      id: "a",
    } as const;
    const url = new URL(menuListUrl(params), "http://x");

    expect(parseMenuListUrl(url.searchParams)).toEqual(params);

    const withIds = { action: "remove-many", ids: ["a", "b"] } as const;
    const idsUrl = new URL(menuListUrl({ ...withIds, ids: [...withIds.ids] }), "http://x");

    expect(parseMenuListUrl(idsUrl.searchParams)).toEqual(withIds);
  });

  it("drops invalid list values and prefers `after` over `before`", () => {
    expect(
      parseMenuListUrl(
        new URLSearchParams("sort=price&asc=maybe&action=nuke&after=a&before=b&query="),
      ),
    ).toEqual({ after: "a" });
  });

  it("parses the detail params, round-tripping what it builds", () => {
    const url = new URL(menuUrl("a", { action: "edit-item", id: "b" }), "http://x");

    expect(parseMenuUrl(url.searchParams)).toEqual({ action: "edit-item", id: "b" });
  });

  it("drops a detail dialog the screen doesn't know", () => {
    expect(parseMenuUrl(new URLSearchParams("action=nuke"))).toEqual({});
    expect(parseMenuUrl(new URLSearchParams(""))).toEqual({});
  });
});
