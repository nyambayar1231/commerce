// Adapted from saleor-dashboard: src/categories/views/CategoryList/types.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { CategoryFragment } from "../../../graphql/types.generated";

export interface CategoryListCategoryRow {
  type: "category";
  category: CategoryFragment;
  depth: number;
  parentId: string | null;
}

export interface CategoryListLoadMoreRow {
  type: "load-more";
  parentId: string;
  depth: number;
  remainingCount: number;
}

export type CategoryListRow = CategoryListCategoryRow | CategoryListLoadMoreRow;

export const isCategoryListCategoryRow = (row: CategoryListRow): row is CategoryListCategoryRow =>
  row.type === "category";
