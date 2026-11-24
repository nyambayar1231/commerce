// Adapted from saleor-dashboard: src/structures/components/MenuItems/tree.ts and
// src/structures/components/MenuDetailsPage/tree.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor
// Commerce)
// See THIRD_PARTY_LICENSES.md
// The menu tree's structural edits. Saleor diffs the tree with fast-array-diff and replays the
// operations locally; we only need moves (item deletion persists immediately), so this file
// computes the moves that turn one tree into another under the API's `menuItemMove` semantics
// (parentId, then a sortOrder relative to the item's position in its new sibling group) and applies
// a move the same way for rendering.
import type { RecursiveMenuItem } from "../../types";

export type TreeOperationType = "move";

export interface TreeOperation {
  id: string;
  type: TreeOperationType;
  parentId: string | null;
  sortOrder: number;
}

const childrenOf = (item: RecursiveMenuItem): RecursiveMenuItem[] => item.children ?? [];

function findItem(tree: RecursiveMenuItem[], id: string): RecursiveMenuItem | undefined {
  for (const item of tree) {
    if (item.id === id) {
      return item;
    }

    const found = findItem(childrenOf(item), id);

    if (found) {
      return found;
    }
  }

  return undefined;
}

/** The items under one parent, in order (the root list when `parentId` is null). */
export function siblings(tree: RecursiveMenuItem[], parentId: string | null): RecursiveMenuItem[] {
  if (parentId === null) {
    return tree;
  }

  const parent = findItem(tree, parentId);

  return parent ? childrenOf(parent) : [];
}

function parentOf(
  tree: RecursiveMenuItem[],
  id: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const item of tree) {
    if (item.id === id) {
      return parentId;
    }

    const found = parentOf(childrenOf(item), id, item.id);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

const removeItem = (tree: RecursiveMenuItem[], id: string): RecursiveMenuItem[] =>
  tree
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, children: removeItem(childrenOf(item), id) }));

const insertItem = (
  tree: RecursiveMenuItem[],
  parentId: string | null,
  index: number,
  node: RecursiveMenuItem,
): RecursiveMenuItem[] => {
  if (parentId === null) {
    const next = [...tree];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node);

    return next;
  }

  return tree.map((item) => {
    if (item.id === parentId) {
      const children = [...childrenOf(item)];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, node);

      return { ...item, children };
    }

    return { ...item, children: insertItem(childrenOf(item), parentId, index, node) };
  });
};

const replaceSiblings = (
  tree: RecursiveMenuItem[],
  parentId: string | null,
  items: RecursiveMenuItem[],
): RecursiveMenuItem[] => {
  if (parentId === null) {
    return items;
  }

  return tree.map((item) =>
    item.id === parentId
      ? { ...item, children: items }
      : { ...item, children: replaceSiblings(childrenOf(item), parentId, items) },
  );
};

const siblingIndex = (tree: RecursiveMenuItem[], parentId: string | null, id: string): number =>
  siblings(tree, parentId).findIndex((item) => item.id === id);

/**
 * Applies one `menuItemMove` operation to a tree exactly as the API does: a same-parent move
 * shifts the item within its group, a parent change removes it, appends it to the new group and
 * then shifts it by `sortOrder`.
 */
export function applyMove(
  tree: RecursiveMenuItem[],
  operation: TreeOperation,
): RecursiveMenuItem[] {
  const node = findItem(tree, operation.id);

  if (!node) {
    return tree;
  }

  const currentParent = parentOf(tree, operation.id) ?? null;

  if (currentParent === operation.parentId) {
    const group = siblings(tree, operation.parentId);
    const from = siblingIndex(tree, operation.parentId, operation.id);
    const to = Math.max(0, Math.min(from + operation.sortOrder, group.length - 1));

    if (from === to) {
      return tree;
    }

    const next = [...group];
    next.splice(from, 1);
    next.splice(to, 0, node);

    return replaceSiblings(tree, operation.parentId, next);
  }

  const without = removeItem(tree, operation.id);
  // The API appends the item to its new group, so its position before the shift is the group's
  // previous length.
  const from = siblings(without, operation.parentId).length;
  const to = Math.max(0, Math.min(from + operation.sortOrder, from));

  return insertItem(without, operation.parentId, to, node);
}

/** Replays pending moves over the server's tree, as Saleor's computeRelativeTree. */
export function computeRelativeTree(
  tree: RecursiveMenuItem[],
  operations: TreeOperation[],
): RecursiveMenuItem[] {
  return operations.reduce(applyMove, tree);
}

const preorder = (tree: RecursiveMenuItem[]): RecursiveMenuItem[] =>
  tree.flatMap((item) => [item, ...preorder(childrenOf(item))]);

const sameStructure = (left: RecursiveMenuItem[], right: RecursiveMenuItem[]): boolean =>
  left.length === right.length &&
  left.every(
    (item, index) =>
      item.id === right[index]?.id && sameStructure(childrenOf(item), childrenOf(right[index])),
  );

/**
 * Whether two trees differ structurally (ids and nesting; item fields are not compared). Keeps
 * Save disabled when only the name changed or nothing did.
 */
export function treesDiffer(left: RecursiveMenuItem[], right: RecursiveMenuItem[]): boolean {
  return !sameStructure(left, right);
}

/**
 * The moves that turn `original` into `target`: first the items whose parent changed (parents are
 * placed before their children, so no transient state is deeper than the target), then each group's
 * order. Applying them with `applyMove` yields `target`.
 */
export function getDiff(
  original: RecursiveMenuItem[],
  target: RecursiveMenuItem[],
): TreeOperation[] {
  const operations: TreeOperation[] = [];
  let current = original;

  for (const item of preorder(target)) {
    const targetParent = parentOf(target, item.id) ?? null;
    const currentParent = parentOf(current, item.id) ?? null;

    if (targetParent === currentParent) {
      continue;
    }

    const targetIndex = siblingIndex(target, targetParent, item.id);
    const from = siblings(current, targetParent).length;
    const operation: TreeOperation = {
      id: item.id,
      type: "move",
      parentId: targetParent,
      sortOrder: targetIndex - from,
    };

    operations.push(operation);
    current = applyMove(current, operation);
  }

  for (const parentId of [null, ...preorder(target).map((item) => item.id)]) {
    const targetGroup = siblings(target, parentId);

    for (const [targetIndex, item] of targetGroup.entries()) {
      const currentGroup = siblings(current, parentId);
      const currentIndex = currentGroup.findIndex((sibling) => sibling.id === item.id);

      if (currentIndex === targetIndex || currentIndex === -1) {
        continue;
      }

      const operation: TreeOperation = {
        id: item.id,
        type: "move",
        parentId,
        sortOrder: targetIndex - currentIndex,
      };

      operations.push(operation);
      current = applyMove(current, operation);
    }
  }

  return operations;
}
