// Adapted from saleor-dashboard: src/components/SortableTree/hooks/useItems.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";

import type { DataTypePlaceholder, TreeItems } from "../types";
import { flattenTree, removeChildrenOf } from "../utils";

interface UseItemsProps<T extends DataTypePlaceholder> {
  defaultItems: TreeItems<T>;
  activeId: UniqueIdentifier | null;
}

export const useItems = <T extends DataTypePlaceholder>({
  defaultItems,
  activeId,
}: UseItemsProps<T>) => {
  const [items, setItems] = useState(defaultItems);

  useEffect(() => {
    setItems(defaultItems);
  }, [defaultItems]);

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(items);

    return removeChildrenOf(flattenedTree, activeId ? [activeId] : []);
  }, [activeId, items]);

  return {
    items,
    setItems,
    flattenedItems,
  };
};
