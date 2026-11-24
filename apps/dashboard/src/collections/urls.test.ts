import { describe, expect, it } from "vitest";

import {
  collectionListUrl,
  collectionPath,
  collectionUrl,
  parseCollectionListUrl,
  parseCollectionUrl,
} from "./urls";

describe("collection urls", () => {
  it("builds the list URL with Saleor's trailing '?' and its params", () => {
    expect(collectionListUrl()).toBe("/collections/?");
    expect(collectionListUrl({ action: "create" })).toBe("/collections/?action=create");
    expect(collectionListUrl({ sort: "name", asc: true, query: "" })).toBe(
      "/collections/?sort=name&asc=true",
    );
    expect(collectionListUrl({ status: "hidden", sort: "productCount", asc: false })).toBe(
      "/collections/?status=hidden&sort=productCount&asc=false",
    );
    expect(collectionListUrl({ after: "abc=", asc: false })).toBe(
      "/collections/?after=abc%3D&asc=false",
    );
  });

  it("serialises the bulk-selection ids comma-separated (Saleor's qs uses indexed keys)", () => {
    expect(collectionListUrl({ action: "remove", ids: ["a", "b"] })).toBe(
      "/collections/?action=remove&ids=a%2Cb",
    );
    expect(collectionListUrl({ action: "remove", ids: [] })).toBe("/collections/?action=remove");
  });

  it("encodes the global ID in the detail URL", () => {
    expect(collectionPath("Q29sbGVjdGlvbjox")).toBe("/collections/Q29sbGVjdGlvbjox");
    expect(collectionUrl("Q29sbGVjdGlvbjox")).toBe("/collections/Q29sbGVjdGlvbjox?");
    expect(collectionUrl("a", { action: "remove" })).toBe("/collections/a?action=remove");
  });

  it("parses the list params, round-tripping what it builds", () => {
    const params = {
      query: "boots",
      status: "published",
      sort: "availability",
      asc: false,
      after: "c=",
    } as const;
    const url = new URL(collectionListUrl(params), "http://x");
    expect(parseCollectionListUrl(url.searchParams)).toEqual(params);

    const withIds = { action: "remove", ids: ["a", "b"] } as const;
    const idsUrl = new URL(collectionListUrl({ ...withIds, ids: [...withIds.ids] }), "http://x");
    expect(parseCollectionListUrl(idsUrl.searchParams)).toEqual(withIds);
  });

  it("drops invalid values and prefers `after` over `before`", () => {
    expect(
      parseCollectionListUrl(
        new URLSearchParams("sort=price&asc=maybe&action=nuke&status=all&after=a&before=b&query="),
      ),
    ).toEqual({ after: "a" });
  });
});

describe("collection detail urls", () => {
  it("builds the detail URL with the open dialog and the selected rows", () => {
    expect(collectionUrl("a", { action: "assign" })).toBe("/collections/a?action=assign");
    expect(collectionUrl("a", { action: "unassign", ids: ["b", "c"] })).toBe(
      "/collections/a?action=unassign&ids=b%2Cc",
    );
  });

  it("parses the detail params, round-tripping what it builds", () => {
    const url = new URL(collectionUrl("a", { action: "unassign", ids: ["b", "c"] }), "http://x");

    expect(parseCollectionUrl(url.searchParams)).toEqual({ action: "unassign", ids: ["b", "c"] });
  });

  it("drops a dialog the page doesn't know", () => {
    expect(parseCollectionUrl(new URLSearchParams("action=nuke"))).toEqual({});
    expect(parseCollectionUrl(new URLSearchParams(""))).toEqual({});
  });
});
