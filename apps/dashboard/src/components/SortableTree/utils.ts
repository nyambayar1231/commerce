// Adapted from saleor-dashboard: src/components/SortableTree/utils.ts (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The tree maths: projection of the row under the pointer (depth and parent), flattening and
// building back. Unlike Saleor's copy, getProjection takes an absolute `maxDepth` cap (our menu
// items nest at most three levels), so a drop that would go deeper projects to the deepest allowed
// row instead.
import type { UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import type {
  DataTypePlaceholder,
  FlattenedItem,
  FlattenedItems,
  Projected,
  TreeItem,
  TreeItems,
} from "./types";

function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth);
}

export function getProjection<T extends DataTypePlaceholder>(
  items: FlattenedItems<T>,
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number,
  maxDepth = Number.POSITIVE_INFINITY,
): Projected {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];

  if (!activeItem) {
    return { depth: 0, maxDepth: Math.max(0, maxDepth), minDepth: 0, parentId: null };
  }

  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepthAllowed = Math.min(getMaxDepth({ previousItem }), maxDepth);
  const minDepth = getMinDepth({ nextItem });
  let depth = projectedDepth;

  if (projectedDepth >= maxDepthAllowed) {
    depth = maxDepthAllowed;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  return { depth, maxDepth: maxDepthAllowed, minDepth, parentId: getParentId() };

  function getParentId() {
    if (depth === 0 || !previousItem) {
      return null;
    }

    if (depth === previousItem.depth) {
      return previousItem.parentId;
    }

    if (depth > previousItem.depth) {
      return previousItem.id;
    }

    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;

    return newParent ?? null;
  }
}

function getMaxDepth<T extends DataTypePlaceholder>({
  previousItem,
}: {
  previousItem: FlattenedItem<T> | undefined;
}) {
  if (previousItem) {
    return previousItem.depth + 1;
  }

  return 0;
}

function getMinDepth<T extends DataTypePlaceholder>({
  nextItem,
}: {
  nextItem: FlattenedItem<T> | undefined;
}) {
  if (nextItem) {
    return nextItem.depth;
  }

  return 0;
}

function flatten<T extends DataTypePlaceholder>(
  items: TreeItems<T>,
  parentId: UniqueIdentifier | null = null,
  depth = 0,
): FlattenedItems<T> {
  const flattened: FlattenedItems<T> = [];

  items.forEach((item, index) => {
    flattened.push({ ...item, parentId, depth, index });
    flattened.push(...flatten(item.children, item.id, depth + 1));
  });

  return flattened;
}

export function flattenTree<T extends DataTypePlaceholder>(items: TreeItems<T>): FlattenedItems<T> {
  return flatten(items);
}

export function buildTree<T extends DataTypePlaceholder>(
  flattenedItems: FlattenedItems<T>,
): TreeItems<T> {
  const root: TreeItem<T> = { id: "root", data: null as T, children: [] };
  const nodes: Record<string, TreeItem<T>> = { [root.id]: root };
  const items = flattenedItems.map((item) => ({ ...item, children: [] }));

  for (const item of items) {
    const { id, children } = item;
    const parentId = item.parentId ?? root.id;
    const parent = nodes[parentId] ?? findItem(items, parentId);

    if (!parent) {
      continue;
    }

    nodes[id] = { id, children, data: null as T };
    parent.children.push(item);
  }

  return root.children;
}

function findItem<T extends DataTypePlaceholder>(
  items: Array<TreeItem<T>>,
  itemId: UniqueIdentifier,
) {
  return items.find(({ id }) => id === itemId);
}

function findItemDeep<T extends DataTypePlaceholder>(
  items: TreeItems<T>,
  itemId: UniqueIdentifier,
): TreeItem<T> | undefined {
  for (const item of items) {
    const { id, children } = item;

    if (id === itemId) {
      return item;
    }

    if (children.length) {
      const child = findItemDeep(children, itemId);

      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

function countChildren<T extends DataTypePlaceholder>(
  items: Array<TreeItem<T>>,
  count = 0,
): number {
  return items.reduce((acc, { children }) => {
    if (children.length) {
      return countChildren(children, acc + 1);
    }

    return acc + 1;
  }, count);
}

export function getChildCount<T extends DataTypePlaceholder>(
  items: TreeItems<T>,
  id: UniqueIdentifier,
) {
  const item = findItemDeep(items, id);

  return item ? countChildren(item.children) : 0;
}

export function removeChildrenOf<T extends DataTypePlaceholder>(
  items: FlattenedItems<T>,
  ids: UniqueIdentifier[],
) {
  const excludeParentIds = [...ids];

  return items.filter((item) => {
    if (item.parentId && excludeParentIds.includes(item.parentId)) {
      if (item.children.length) {
        excludeParentIds.push(item.id);
      }

      return false;
    }

    return true;
  });
}
