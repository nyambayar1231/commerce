// Adapted from saleor-dashboard: src/components/SortableTree/SortableTree.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's generic drag-and-drop tree. Our addition is the optional `maxDepth` prop, which keeps
// the projection from creating a level the API refuses (menu items nest at three levels).
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { dropAnimationConfig, measuring } from "./config";
import { useAnnouncement } from "./hooks/useAnnouncement";
import { useItems } from "./hooks/useItems";
import { useSortableHandlers } from "./hooks/useSortableHandlers";
import { sortableTreeKeyboardCoordinates } from "./keyboardCoordinates";
import { SortableTreeItem } from "./SortableTreeItem";
import type {
  DataTypePlaceholder,
  SensorContext,
  TreeItemComponentProps,
  TreeItems,
} from "./types";
import { getChildCount } from "./utils";

interface SortableTreeProps<T extends DataTypePlaceholder> {
  items: TreeItems<T>;
  renderTreeItem: (props: TreeItemComponentProps<T>) => ReactNode;
  onChange: (newItems: TreeItems<T>) => void;
  indentationWidth?: number;
  /** The deepest level the tree allows (0 = flat). Unlimited when omitted. */
  maxDepth?: number;
}

export function SortableTree<T extends DataTypePlaceholder>({
  items: defaultItems,
  onChange,
  renderTreeItem,
  indentationWidth = 50,
  maxDepth,
}: SortableTreeProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { items, flattenedItems, setItems } = useItems({
    defaultItems,
    activeId,
  });
  const {
    offsetLeft,
    currentPosition,
    setCurrentPosition,
    handleDragCancel,
    handleDragEnd,
    handleDragMove,
    handleDragOver,
    handleDragStart,
    projected,
  } = useSortableHandlers({
    onChange,
    items,
    flattenedItems,
    setItems,
    setActiveId,
    indentationWidth,
    maxDepth,
    activeId,
  });
  const announcements = useAnnouncement({
    projected,
    items,
    currentPosition,
    setCurrentPosition,
  });
  const sensorContext: SensorContext<T> = useRef({
    items: flattenedItems,
    offset: offsetLeft,
  });
  const [coordinateGetter] = useState(() =>
    sortableTreeKeyboardCoordinates(sensorContext, indentationWidth, maxDepth),
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter,
    }),
  );
  const sortedIds = useMemo(() => flattenedItems.map(({ id }) => id), [flattenedItems]);
  const activeItem = activeId ? flattenedItems.find(({ id }) => id === activeId) : null;

  useEffect(() => {
    sensorContext.current = {
      items: flattenedItems,
      offset: offsetLeft,
    };
  }, [flattenedItems, offsetLeft]);

  return (
    <DndContext
      accessibility={{ announcements }}
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {flattenedItems.map(({ id, depth, data }) => (
          <SortableTreeItem
            key={id}
            data={data}
            id={id}
            depth={id === activeId && projected ? projected.depth : depth}
            indentationWidth={indentationWidth}
            renderTreeItem={renderTreeItem}
          />
        ))}
        {createPortal(
          <DragOverlay dropAnimation={dropAnimationConfig}>
            {activeId && activeItem ? (
              <SortableTreeItem
                clone
                data={flattenedItems.find(({ id }) => id === activeId)?.data ?? (null as T)}
                id={activeId}
                depth={activeItem.depth}
                renderTreeItem={renderTreeItem}
                childCount={getChildCount(items, activeId) + 1}
                indentationWidth={indentationWidth}
              />
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </SortableContext>
    </DndContext>
  );
}
