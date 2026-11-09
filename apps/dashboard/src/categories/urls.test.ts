import { describe, expect, it } from "vitest";

import { categoryListUrl, categoryPath, categoryUrl } from "./urls";

describe("category urls", () => {
  it("builds the list URL with Saleor's trailing '?' and the dialog action", () => {
    expect(categoryListUrl()).toBe("/categories/?");
    expect(categoryListUrl({ action: "create" })).toBe("/categories/?action=create");
  });

  it("encodes the global ID in the detail URL", () => {
    expect(categoryPath("Q2F0ZWdvcnk6MQ==")).toBe("/categories/Q2F0ZWdvcnk6MQ==");
    expect(categoryUrl("Q2F0ZWdvcnk6MQ==")).toBe("/categories/Q2F0ZWdvcnk6MQ%3D%3D?");
    expect(categoryUrl("a", { action: "delete" })).toBe("/categories/a?action=delete");
  });
});
