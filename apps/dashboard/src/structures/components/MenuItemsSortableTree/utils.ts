// Adapted from saleor-dashboard: src/structures/components/MenuItemsSortableTree/utils.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Between the recursive item type the screen renders and the SortableTree's generic node, whose
// `data` is the item itself.
import type { MenuTreeItem, RecursiveMenuItem } from "../../types";

export function getNodeData(item: RecursiveMenuItem): MenuTreeItem {
  return {
    children: (item.children ?? []).map(getNodeData),
    data: item,
    id: item.id,
  };
}

/** The tree after a drag, back in the screen's type (children come from the tree, not `data`). */
export function getRecursiveItems(items: MenuTreeItem[]): RecursiveMenuItem[] {
  return items.map((item) => ({
    ...item.data,
    id: String(item.id),
    children: getRecursiveItems(item.children),
  }));
}
