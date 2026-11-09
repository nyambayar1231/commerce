// Adapted from saleor-dashboard: src/categories/views/CategoryList/utils/treeIndent.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
export const TREE_INDENT_DEPTH_MULTIPLIER = 4;

export const formatIndentedTreeLabel = (label: string, depth: number): string =>
  `${"\u00A0".repeat(depth * TREE_INDENT_DEPTH_MULTIPLIER)}${label}`;
