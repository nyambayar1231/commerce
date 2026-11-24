// Adapted from saleor-dashboard: src/structures/types.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The tree the menu screen works with: Saleor's recursive item (the fragment nests as deep as the
// API allows) and the generic SortableTree node that wraps one item as `data`.
import type { TreeItem } from "../components/SortableTree/types";
import type { MenuItemFragment } from "../graphql/types.generated";

export type RecursiveMenuItem = MenuItemFragment & {
  children?: RecursiveMenuItem[];
};

export type MenuTreeItem = TreeItem<MenuItemFragment>;
