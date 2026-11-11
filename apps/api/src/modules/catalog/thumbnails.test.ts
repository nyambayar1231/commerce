import { describe, expect, it } from "vitest";
import {
  getThumbnailSize,
  parseThumbnailUrlFormat,
  THUMBNAIL_SIZES,
  thumbnailUrlFormat,
} from "./index.ts";

// Saleor's `get_thumbnail_size` (saleor/thumbnail/utils.py): exact sizes, NEAREST and UP rounding,
// ties, and values outside the available range.

describe("getThumbnailSize", () => {
  it("keeps every available size as it is, with either rounding", () => {
    for (const size of THUMBNAIL_SIZES) {
      expect(getThumbnailSize(size)).toBe(size);
      expect(getThumbnailSize(size, "NEAREST")).toBe(size);
      expect(getThumbnailSize(size, "UP")).toBe(size);
    }
  });

  it("rounds to the closest available size (NEAREST)", () => {
    expect(getThumbnailSize(40)).toBe(32);
    expect(getThumbnailSize(50)).toBe(64);
    expect(getThumbnailSize(100)).toBe(128);
    expect(getThumbnailSize(300)).toBe(256);
    expect(getThumbnailSize(700)).toBe(512);
    expect(getThumbnailSize(3000)).toBe(2048);
  });

  it("rounds ties down, as Python's min does", () => {
    expect(getThumbnailSize(48)).toBe(32);
    expect(getThumbnailSize(96)).toBe(64);
    expect(getThumbnailSize(192)).toBe(128);
    expect(getThumbnailSize(3072)).toBe(2048);
  });

  it("rounds up to the smallest size not below the request (UP)", () => {
    expect(getThumbnailSize(33, "UP")).toBe(64);
    expect(getThumbnailSize(40, "UP")).toBe(64);
    expect(getThumbnailSize(48, "UP")).toBe(64);
    expect(getThumbnailSize(300, "UP")).toBe(512);
    expect(getThumbnailSize(2049, "UP")).toBe(4096);
  });

  it("clamps values below the smallest size and above the largest", () => {
    for (const rounding of ["NEAREST", "UP"] as const) {
      expect(getThumbnailSize(0, rounding)).toBe(32);
      expect(getThumbnailSize(10, rounding)).toBe(32);
      expect(getThumbnailSize(31, rounding)).toBe(32);
      expect(getThumbnailSize(4097, rounding)).toBe(4096);
      expect(getThumbnailSize(100_000, rounding)).toBe(4096);
    }
  });

  it("uses Saleor's default of 4096 when no size is given", () => {
    expect(getThumbnailSize(null)).toBe(4096);
    expect(getThumbnailSize(undefined)).toBe(4096);
  });
});

describe("thumbnail URL formats", () => {
  it("maps path segments to GraphQL formats, ORIGINAL having none", () => {
    expect(parseThumbnailUrlFormat(null)).toBe("ORIGINAL");
    expect(parseThumbnailUrlFormat("webp")).toBe("WEBP");
    expect(parseThumbnailUrlFormat("AVIF")).toBe("AVIF");
    expect(parseThumbnailUrlFormat("gif")).toBeNull();
    expect(parseThumbnailUrlFormat("original")).toBeNull();

    expect(thumbnailUrlFormat("ORIGINAL")).toBeNull();
    expect(thumbnailUrlFormat("WEBP")).toBe("webp");
    expect(thumbnailUrlFormat("AVIF")).toBe("avif");
  });
});
