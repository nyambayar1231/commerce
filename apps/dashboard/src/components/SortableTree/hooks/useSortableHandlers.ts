// Adapted from saleor-dashboard: src/components/SortableTree/hooks/useSortableHandlers.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The drag lifecycle. `maxDepth` is our addition: it caps the projected depth so a drop can never
// create a fourth level (the API refuses those anyway).
import type {
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { type Dispatch, type SetStateAction, useState } from "react";

import type { CurrentPosition, DataTypePlaceholder, FlattenedItems, TreeItems } from "../types";
import { buildTree, flattenTree, getProjection } from "../utils";

interface UseSortableHandlersProps<T extends DataTypePlaceholder> {
  flattenedItems: FlattenedItems<T>;
  items: TreeItems<T>;
  activeId: UniqueIdentifier | null;
  indentationWidth: number;
  maxDepth?: number;
  setItems: Dispatch<SetStateAction<TreeItems<T>>>;
  setActiveId: Dispatch<SetStateAction<UniqueIdentifier | null>>;
  onChange: (newTree: TreeItems<T>) => void;
}

export const useSortableHandlers = <T extends DataTypePlaceholder>({
  flattenedItems,
  onChange,
  setItems,
  items,
  activeId,
  indentationWidth,
  maxDepth,
  setActiveId,
}: UseSortableHandlersProps<T>) => {
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<CurrentPosition | null>(null);
  const projected =
    activeId && overId
      ? getProjection(flattenedItems, activeId, overId, offsetLeft, indentationWidth, maxDepth)
      : null;
  const handleDragStart = ({ active: { id: activeId } }: DragStartEvent) => {
    setActiveId(activeId);
    setOverId(activeId);

    const activeItem = flattenedItems.find(({ id }) => id === activeId);

    if (activeItem) {
      setCurrentPosition({
        parentId: activeItem.parentId,
        overId: activeId,
      });
    }

    document.body.style.setProperty("cursor", "grabbing");
  };
  const handleDragMove = ({ delta }: DragMoveEvent) => {
    setOffsetLeft(delta.x);
  };
  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over?.id ?? null);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    resetState();

    if (projected && over) {
      const { depth, parentId } = projected;
      const clonedItems: FlattenedItems<T> = JSON.parse(JSON.stringify(flattenTree(items)));
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];

      if (!activeTreeItem) {
        return;
      }

      clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newItems = buildTree(sortedItems);

      setItems(newItems);
      onChange(newItems);
    }
  };
  const handleDragCancel = () => {
    resetState();
  };
  const resetState = () => {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);
    setCurrentPosition(null);
    document.body.style.setProperty("cursor", "");
  };

  return {
    overId,
    projected,
    offsetLeft,
    currentPosition,
    setCurrentPosition,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
};
