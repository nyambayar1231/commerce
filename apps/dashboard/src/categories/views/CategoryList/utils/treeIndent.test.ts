// Adapted from saleor-dashboard: src/categories/views/CategoryList/utils/treeIndent.test.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { describe, expect, it } from "vitest";
import { formatIndentedTreeLabel, TREE_INDENT_DEPTH_MULTIPLIER } from "./treeIndent";

describe("treeIndent", () => {
  it("should not indent root-level labels", () => {
    // Arrange
    const label = "Electronics";

    // Act
    const result = formatIndentedTreeLabel(label, 0);

    // Assert
    expect(result).toBe("Electronics");
  });

  it("should indent nested labels by depth", () => {
    // Arrange
    const label = "Phones";

    // Act
    const result = formatIndentedTreeLabel(label, 2);

    // Assert
    expect(result).toBe(`${"\u00A0".repeat(2 * TREE_INDENT_DEPTH_MULTIPLIER)}Phones`);
  });
});
