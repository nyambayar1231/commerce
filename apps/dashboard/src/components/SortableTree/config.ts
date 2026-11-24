// Adapted from saleor-dashboard: src/components/SortableTree/config.ts (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import {
  type DropAnimation,
  defaultDropAnimation,
  type MeasuringConfiguration,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export const measuring: MeasuringConfiguration = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export const dropAnimationConfig: DropAnimation = {
  keyframes({ transform }) {
    return [
      { opacity: 1, transform: CSS.Transform.toString(transform.initial) },
      {
        opacity: 0,
        transform: CSS.Transform.toString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5,
        }),
      },
    ];
  },
  easing: "ease-out",
  sideEffects({ active }) {
    active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: defaultDropAnimation.duration,
      easing: defaultDropAnimation.easing,
    });
  },
};
