// Adapted from saleor-dashboard: src/products/components/ProductMedia/useProductMediaDrag.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The gallery's drag state: reorder locally on drag over (so tiles follow the pointer), then
// report the moved item's indices on drop. A drop is ignored when the media set changed while
// dragging (an upload or delete completed), because the indices no longer describe the server list.
import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ProductMediaFragment } from "../../../graphql/types.generated";

export interface ReorderEvent {
  oldIndex: number;
  newIndex: number;
}

interface UseProductMediaDragProps {
  media: ProductMediaFragment[];
  onReorder?: (event: ReorderEvent) => void;
  disabled?: boolean;
}

/**
 * Saleor's `createImageReorderHandler` mapping: the media ids in their new order, or null when
 * the indices don't describe a move inside the list.
 */
export const getReorderedMediaIds = (
  mediaIds: readonly string[],
  { oldIndex, newIndex }: ReorderEvent,
): string[] | null => {
  if (
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= mediaIds.length ||
    newIndex >= mediaIds.length ||
    oldIndex === newIndex
  ) {
    return null;
  }

  return arrayMove([...mediaIds], oldIndex, newIndex);
};

export const useProductMediaDrag = ({
  media,
  onReorder,
  disabled = false,
}: UseProductMediaDragProps) => {
  const [orderedMedia, setOrderedMedia] = useState(media);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const orderedMediaRef = useRef(orderedMedia);

  orderedMediaRef.current = orderedMedia;

  useEffect(() => {
    if (activeId === null) {
      setOrderedMedia(media);
    }
  }, [media, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Small drag threshold so a click on the tile still opens it.
        distance: 20,
      },
    }),
  );

  const items: UniqueIdentifier[] = useMemo(
    () => orderedMedia.map((item) => item.id),
    [orderedMedia],
  );

  const activeMedia = useMemo(
    () => orderedMedia.find((item) => item.id === activeId) ?? null,
    [activeId, orderedMedia],
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (disabled) {
      return;
    }

    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (disabled) {
      return;
    }

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setOrderedMedia((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);

      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return current;
      }

      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const finishDrag = () => {
    const draggedId = activeId;

    setActiveId(null);

    if (disabled || !onReorder || draggedId == null) {
      return;
    }

    const endIds = orderedMediaRef.current.map((item) => item.id);
    const currentIds = media.map((item) => item.id);

    // The media set must be unchanged (no upload/delete during the drag) and a pure reordering.
    const isSameSet =
      endIds.length === currentIds.length &&
      currentIds.every((id) => endIds.includes(id)) &&
      endIds.every((id) => currentIds.includes(id));

    if (!isSameSet) {
      setOrderedMedia(media);

      return;
    }

    // Indices relative to the live product.media list the mutation will array-move.
    const oldIndex = currentIds.indexOf(String(draggedId));
    const newIndex = endIds.indexOf(String(draggedId));

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return;
    }

    onReorder({ oldIndex, newIndex });
  };

  const handleDragEnd = (_event: DragEndEvent) => {
    finishDrag();
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOrderedMedia(media);
  };

  return {
    orderedMedia,
    activeId,
    activeMedia,
    items,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
};
