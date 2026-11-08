// Adapted from saleor-dashboard: src/components/Sidebar/useSidebarCollapseToggle.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor tracks the toggle's source (button / shortcut) for analytics; we have no analytics.
import { useCallback } from "react";

import { useSidebarCollapse } from "./SidebarContext";

export const useSidebarCollapseToggle = (): (() => void) => {
  const { isCollapsed, setCollapsed } = useSidebarCollapse();

  return useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);
};
