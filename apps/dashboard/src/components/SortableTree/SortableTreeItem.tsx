// Adapted from saleor-dashboard: src/components/SortableTree/SortableTreeItem.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { UniqueIdentifier } from "@dnd-kit/core";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type * as React from "react";
import type { CSSProperties, ReactNode } from "react";

import type { DataTypePlaceholder, TreeItemComponentProps } from "./types";

interface SortableTreeItemProps<T extends DataTypePlaceholder> extends TreeItemComponentProps<T> {
  id: UniqueIdentifier;
  renderTreeItem: (props: TreeItemComponentProps<T>) => ReactNode;
}

const animateLayoutChanges: AnimateLayoutChanges = ({ isSorting, wasDragging }) =>
  !(isSorting || wasDragging);

export function SortableTreeItem<T extends DataTypePlaceholder>({
  id,
  depth,
  renderTreeItem,
  data,
  ...props
}: SortableTreeItemProps<T>) {
  const {
    attributes,
    isDragging,
    isSorting,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return renderTreeItem({
    id,
    data,
    innerRef: setDraggableNodeRef,
    wrapperRef: setDroppableNodeRef,
    style,
    depth,
    ghost: isDragging,
    disableInteraction: isSorting,
    handleProps: {
      ...attributes,
      ...listeners,
    } as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>,
    ...props,
  });
}
