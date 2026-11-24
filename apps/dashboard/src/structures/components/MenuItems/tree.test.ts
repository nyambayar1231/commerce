import { describe, expect, it } from "vitest";

import type { RecursiveMenuItem } from "../../types";
import { computeRelativeTree, getDiff, type TreeOperation } from "./tree";

const item = (id: string, children: RecursiveMenuItem[] = []): RecursiveMenuItem => ({
  __typename: "MenuItem",
  id,
  name: id,
  level: 0,
  url: null,
  category: null,
  collection: null,
  page: null,
  children,
});

const shape = (tree: RecursiveMenuItem[]): unknown[] =>
  tree.map((node) => [node.id, shape(node.children ?? [])]);

const applyAll = (tree: RecursiveMenuItem[], operations: TreeOperation[]) =>
  computeRelativeTree(tree, operations);

describe("menu tree moves", () => {
  it("reorders siblings with one relative move", () => {
    const original = [item("a"), item("b"), item("c")];
    const target = [item("c"), item("a"), item("b")];
    const operations = getDiff(original, target);

    expect(operations).toEqual([{ id: "c", type: "move", parentId: null, sortOrder: -2 }]);
    expect(shape(applyAll(original, operations))).toEqual(shape(target));
  });

  it("nests an item under its previous sibling", () => {
    const original = [item("a"), item("b")];
    const target = [item("a", [item("b")])];
    const operations = getDiff(original, target);

    expect(operations).toEqual([{ id: "b", type: "move", parentId: "a", sortOrder: 0 }]);
    expect(shape(applyAll(original, operations))).toEqual(shape(target));
  });

  it("lifts a child to the top level at a chosen position", () => {
    const original = [item("a", [item("b"), item("c")])];
    const target = [item("c"), item("a", [item("b")])];
    const operations = getDiff(original, target);

    expect(operations.length).toBeGreaterThan(0);
    expect(shape(applyAll(original, operations))).toEqual(shape(target));
  });

  it("moves a whole subtree and keeps its children", () => {
    const original = [item("a"), item("b", [item("c", [item("d")])])];
    const target = [item("a", [item("b", [item("c", [item("d")])])])];
    const operations = getDiff(original, target);

    expect(shape(applyAll(original, operations))).toEqual(shape(target));
  });

  it("returns no moves for an unchanged tree", () => {
    const tree = [item("a", [item("b")]), item("c")];

    expect(getDiff(tree, tree)).toEqual([]);
    expect(computeRelativeTree(tree, [])).toBe(tree);
  });

  it("replays several pending move groups in order", () => {
    // First drag: b under a. Second drag: c to the top level before a.
    const original = [item("a"), item("b"), item("c")];
    const afterNesting = [item("a", [item("b")]), item("c")];
    const operations = [
      ...getDiff(original, afterNesting),
      ...getDiff(afterNesting, [item("c"), item("a", [item("b")])]),
    ];

    expect(shape(applyAll(original, operations))).toEqual(
      shape([item("c"), item("a", [item("b")])]),
    );
  });
});
