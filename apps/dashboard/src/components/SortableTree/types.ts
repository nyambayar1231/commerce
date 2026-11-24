// Adapted from saleor-dashboard: src/components/SortableTree/types.ts (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { UniqueIdentifier } from "@dnd-kit/core";
import type * as React from "react";
import type { MutableRefObject } from "react";

export type DataTypePlaceholder = Record<string, unknown> | null;

export interface TreeItem<T extends DataTypePlaceholder> {
  id: UniqueIdentifier;
  data: T;
  children: Array<TreeItem<T>>;
}

export type TreeItems<T extends DataTypePlaceholder> = Array<TreeItem<T>>;

export interface FlattenedItem<T extends DataTypePlaceholder> extends TreeItem<T> {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

export type FlattenedItems<T extends DataTypePlaceholder> = Array<FlattenedItem<T>>;

export type SensorContext<T extends DataTypePlaceholder> = MutableRefObject<{
  items: FlattenedItems<T>;
  offset: number;
}>;

/** The drag handle's dnd-kit attributes and listeners, spread by the item's own renderer. */
export type TreeItemHandleProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export interface TreeItemComponentProps<T extends DataTypePlaceholder> {
  data: T;
  id: UniqueIdentifier;
  childCount?: number;
  clone?: boolean;
  depth: number;
  disableInteraction?: boolean;
  ghost?: boolean;
  handleProps?: TreeItemHandleProps;
  indentationWidth: number;
  style?: React.CSSProperties;
  wrapperRef?: (node: HTMLDivElement) => void;
  innerRef?: (node: HTMLDivElement) => void;
}

export interface Projected {
  depth: number;
  maxDepth: number;
  minDepth: number;
  parentId: UniqueIdentifier | null;
}

export interface CurrentPosition {
  parentId: UniqueIdentifier | null;
  overId: UniqueIdentifier;
}
