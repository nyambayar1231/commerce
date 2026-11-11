// Adapted from saleor-dashboard: src/components/Draggable/Draggable.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A sortable wrapper: the render prop receives the node ref, style and the attributes/listeners
// that make the child draggable. `animateLayoutChanges` is off on purpose: flex/grid reflows look
// like a slide from the left after a drop.
import type { DraggableAttributes } from "@dnd-kit/core";
import { type AnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type * as React from "react";

type DraggableRenderProps = {
  ref: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  isDragging: boolean;
} & DraggableAttributes;

interface DraggableProps {
  id: string;
  children: (props: DraggableRenderProps) => React.ReactElement;
  disabled?: boolean;
}

const animateLayoutChanges: AnimateLayoutChanges = () => false;

export const Draggable = ({ id, children, disabled }: DraggableProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    animateLayoutChanges,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // Only keep the live-drag transition; never animate into the post-drop layout.
    transition: isDragging ? transition : undefined,
  };

  return children({
    ref: setNodeRef,
    style,
    isDragging,
    ...attributes,
    ...listeners,
  });
};
