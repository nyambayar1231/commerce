import { describe, expect, it } from "vitest";

import { getProductAvailability } from "./availability";

const now = Date.parse("2026-11-10T12:00:00Z");

describe("collection products availability", () => {
  it("is published when published with no date or a past date", () => {
    expect(getProductAvailability({ isPublished: true, publishedAt: null }, now)).toBe("published");
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T11:00:00Z" }, now),
    ).toBe("published");
  });

  it("is not published when the product is unpublished, whatever the date", () => {
    expect(getProductAvailability({ isPublished: false, publishedAt: null }, now)).toBe(
      "not-published",
    );
    expect(
      getProductAvailability({ isPublished: false, publishedAt: "2026-11-10T11:00:00Z" }, now),
    ).toBe("not-published");
  });

  it("is scheduled while the publication date is in the future", () => {
    // Saleor's 2-second clock-skew tolerance keeps a just-passed date published.
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T12:00:01Z" }, now),
    ).toBe("published");
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T12:00:05Z" }, now),
    ).toBe("scheduled");
  });
});
