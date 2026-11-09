// Adapted from saleor-dashboard: src/categories/views/CategoryList/expandedIdsStorage.test.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { describe, expect, it } from "vitest";
import { normalizeStoredExpandedIds, serializeExpandedIds } from "./expandedIdsStorage";

describe("expandedIdsStorage", () => {
  it("should normalize stored ids to unique string values", () => {
    // Arrange
    const storedValue: unknown = ["cat-2", 10, "cat-1", "cat-2", null];

    // Act
    const result = normalizeStoredExpandedIds(storedValue);

    // Assert
    expect(result).toEqual(["cat-2", "cat-1"]);
  });

  it("should return empty array for invalid storage payload", () => {
    // Arrange
    const storedValue: unknown = { ids: ["cat-1"] };

    // Act
    const result = normalizeStoredExpandedIds(storedValue);

    // Assert
    expect(result).toEqual([]);
  });

  it("should serialize expanded ids as sorted array", () => {
    // Arrange
    const expandedIds = new Set(["cat-3", "cat-1", "cat-2"]);

    // Act
    const result = serializeExpandedIds(expandedIds);

    // Assert
    expect(result).toEqual(["cat-1", "cat-2", "cat-3"]);
  });
});
