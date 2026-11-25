import { describe, expect, it } from "vitest";
import { defaultOpenGraph, openGraphFor } from "./metadata";

describe("open graph helpers", () => {
  it("defaults to a Mongolian website with the shop name", () => {
    expect(defaultOpenGraph("Дэлгүүр")).toEqual({
      type: "website",
      locale: "mn_MN",
      siteName: "Дэлгүүр",
    });
  });

  it("keeps the defaults when a route adds its own fields", () => {
    expect(openGraphFor("Дэлгүүр", { images: ["https://x/y.webp"] })).toEqual({
      type: "website",
      locale: "mn_MN",
      siteName: "Дэлгүүр",
      images: ["https://x/y.webp"],
    });
  });
});
