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

const toComparablePath = (url: string): string => (url.split("?")[0] ?? url).replace(/\/$/, "");

const isSamePath = (first: string | undefined, second: string | undefined): boolean =>
  Boolean(first && second && toComparablePath(first) === toComparablePath(second));

/**
 * In the collapsed rail a group opens a flyout instead of navigating. Its own page needs a
 * link there unless a child already goes to it (Catalog → Products, Fulfillment → Orders).
 */
export const shouldLinkGroupInFlyout = (group: SidebarMenuItem): boolean =>
  Boolean(group.url) && !(group.children ?? []).some((child) => isSamePath(child.url, group.url));

/**
 * Children as listed in the rail flyout. Row adornments are dropped: the unpin action confirms
 * in a dialog, and opening it would dismiss the flyout under it. The group's own click handler
 * (e.g. clearing the extensions alert) moves to the child that opens the group's page.
 */
export const getRailFlyoutChildren = (group: SidebarMenuItem): SidebarMenuItem[] =>
  (group.children ?? []).map((child) => {
    const flyoutChild: SidebarMenuItem = { ...child, endAdornment: undefined };

    if (!group.onClick || !isSamePath(child.url, group.url)) {
      return flyoutChild;
    }

    return {
      ...flyoutChild,
      onClick: () => {
        child.onClick?.();
        group.onClick?.();
      },
    };
  });
