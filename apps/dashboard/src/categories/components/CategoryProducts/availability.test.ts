import { describe, expect, it } from "vitest";

import { getProductAvailability } from "./availability";

const now = Date.parse("2026-11-10T12:00:00Z");

describe("category products availability", () => {
  it("is published when published with no date or a past date", () => {
    expect(getProductAvailability({ isPublished: true, publishedAt: null }, now)).toBe("published");
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T11:00:00Z" }, now),
    ).toBe("published");
  });

  it("is hidden when not published", () => {
    expect(getProductAvailability({ isPublished: false, publishedAt: null }, now)).toBe("hidden");
    expect(
      getProductAvailability({ isPublished: false, publishedAt: "2026-11-10T11:00:00Z" }, now),
    ).toBe("hidden");
  });

  it("is hidden while the publication date is in the future", () => {
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T12:00:01Z" }, now),
    ).toBe("published");
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T12:00:05Z" }, now),
    ).toBe("hidden");
  });
});
