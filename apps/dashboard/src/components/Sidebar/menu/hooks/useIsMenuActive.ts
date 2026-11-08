// Adapted from saleor-dashboard: src/components/Sidebar/menu/hooks/useIsMenuActive.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useLocation } from "react-router";

import type { SidebarMenuItem } from "../types";
import { isMenuActive } from "../utils";

export const useIsMenuActive = (menuItem: SidebarMenuItem): boolean => {
  const location = useLocation();

  // Saleor passes the search for navigation pins; harmless without them.
  return isMenuActive(location.pathname + location.search, menuItem);
};
