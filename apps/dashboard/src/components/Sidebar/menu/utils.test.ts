// Adapted from saleor-dashboard: src/components/Sidebar/menu/utils.test.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the generic isMenuActive cases; extension, order-draft, navigation-pin, customer-type and
// "/dashboard"-prefix cases test code we didn't port (PLAN.md M0.3.5).
import { describe, expect, it } from "vitest";

import type { SidebarMenuItem } from "./types";
import { isMenuActive } from "./utils";

describe("isMenuActive", () => {
  const mockMenuItem: SidebarMenuItem = {
    id: "test-item",
    label: "Test Item",
    url: "/test",
    type: "item",
  };

  it("should identify menu item as active when current path matches its URL", () => {
    const result = isMenuActive("/test", mockMenuItem);

    expect(result).toBe(true);
  });

  it("should identify menu item as active when current path matches one of its alternative URLs (matchUrls)", () => {
    const menuItemWithMatchUrls: SidebarMenuItem = {
      ...mockMenuItem,
      matchUrls: ["/test/alternative", "/test"],
    };
    const result = isMenuActive("/test/alternative", menuItemWithMatchUrls);

    expect(result).toBe(true);
  });

  it("should identify menu item as inactive when current path matches none of its URLs", () => {
    const result = isMenuActive("/different", mockMenuItem);

    expect(result).toBe(false);
  });

  it("should correctly match paths by ignoring query parameters in current location and item URLs", () => {
    const result = isMenuActive("/test?param=value", mockMenuItem);

    expect(result).toBe(true);
  });

  it("should identify Home menu item (URL '/home') as active when current path is '/home'", () => {
    const homeMenuItem: SidebarMenuItem = {
      ...mockMenuItem,
      url: "/home",
    };
    const result = isMenuActive("/home", homeMenuItem);

    expect(result).toBe(true);
  });

  it("should identify Home menu item (URL '/home') as active on home sub-routes", () => {
    const homeMenuItem: SidebarMenuItem = {
      ...mockMenuItem,
      url: "/home",
    };

    expect(isMenuActive("/home/widgets", homeMenuItem)).toBe(true);
  });

  it("should identify item as inactive if its main URL is undefined and no alternative URLs match", () => {
    const menuItemWithOnlyMatchUrls: SidebarMenuItem = {
      id: "test-item-match",
      label: "Test Item Match",
      matchUrls: ["/foo", "/bar"],
      type: "item",
    };
    const result = isMenuActive("/baz", menuItemWithOnlyMatchUrls);

    expect(result).toBe(false);
  });

  it("should identify item as active if its main URL is undefined and an alternative URL matches", () => {
    const menuItemWithOnlyMatchUrls: SidebarMenuItem = {
      id: "test-item-match",
      label: "Test Item Match",
      matchUrls: ["/foo", "/bar"],
      type: "item",
    };
    const result = isMenuActive("/foo", menuItemWithOnlyMatchUrls);

    expect(result).toBe(true);
  });

  it("should identify item as inactive if it has no main URL or alternative URLs defined", () => {
    const menuItemWithoutUrls: SidebarMenuItem = {
      id: "test-item-no-urls",
      label: "Test Item No URLs",
      type: "item",
    };
    const result = isMenuActive("/anywhere", menuItemWithoutUrls);

    expect(result).toBe(false);
  });

  // Ours: v5's matchPath and React Router 7's (`end: false`) both match whole segments only.
  it("should not treat a longer path segment as a sub-route", () => {
    expect(isMenuActive("/testing", mockMenuItem)).toBe(false);
  });

  // Ours: the menu links to "/products/" (Saleor's list URL) but routes render at "/products".
  it("should match a trailing-slash menu URL without the slash", () => {
    expect(isMenuActive("/products", { ...mockMenuItem, url: "/products/" })).toBe(true);
  });
});
