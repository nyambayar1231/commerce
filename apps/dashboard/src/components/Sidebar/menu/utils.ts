// Adapted from saleor-dashboard: src/components/Sidebar/menu/utils.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { matchPath } from "react-router";

import type { SidebarMenuItem } from "./types";

// Saleor's version also handles extensions, navigation pins, customer-type shortcuts, draft orders
// and a "/dashboard" mount prefix; none of those exist here. React Router 7's `end` replaces
// v5's `exact`.
export function isMenuActive(location: string, menuItem: SidebarMenuItem) {
  const menuUrlsToCheck = [...(menuItem.matchUrls || []), menuItem.url]
    .filter((item): item is string => Boolean(item))
    .map((item) => item.split("?")[0] ?? item);

  if (menuUrlsToCheck.length === 0) {
    return false;
  }

  const activeUrl = location.split("?")[0] ?? location;

  return menuUrlsToCheck.some((menuItemUrl) => {
    return !!matchPath({ path: menuItemUrl, end: menuItemUrl === "/" }, activeUrl);
  });
}
