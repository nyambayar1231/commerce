// Adapted from saleor-dashboard: src/components/Sidebar/menu/utils.test.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the generic isMenuActive cases and the rail helpers; extension, order-draft,
// navigation-pin, customer-type and "/dashboard"-prefix cases test code we didn't port
// (PLAN.md M0.3.5).
import { describe, expect, it, vi } from "vitest";

import type { SidebarMenuItem } from "./types";
import { getRailFlyoutChildren, isMenuActive, shouldLinkGroupInFlyout } from "./utils";

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

describe("shouldLinkGroupInFlyout", () => {
  it("does not link the group when a child already opens its page", () => {
    // Arrange
    const catalog: SidebarMenuItem = {
      id: "products",
      label: "Catalog",
      url: "/products/",
      type: "itemGroup",
      children: [
        { id: "products", label: "Products", url: "/products", type: "item" },
        { id: "categories", label: "Categories", url: "/categories/", type: "item" },
      ],
    };

    // Act & Assert
    expect(shouldLinkGroupInFlyout(catalog)).toBe(false);
  });

  it("ignores the query string when matching a child to the group page", () => {
    // Arrange
    const customers: SidebarMenuItem = {
      id: "customers",
      label: "Customers",
      url: "/customers/",
      type: "itemGroup",
      children: [{ id: "all", label: "All", url: "/customers/?customerTypes=", type: "item" }],
    };

    // Act & Assert
    expect(shouldLinkGroupInFlyout(customers)).toBe(false);
  });

  it("links the group when no child opens its page", () => {
    // Arrange
    const home: SidebarMenuItem = {
      id: "home",
      label: "Home",
      url: "/home",
      type: "itemGroup",
      children: [{ id: "home-widget-1", label: "Pulse", url: "/home/widgets/1", type: "item" }],
    };

    // Act & Assert
    expect(shouldLinkGroupInFlyout(home)).toBe(true);
  });

  it("does not link a group without a page", () => {
    // Arrange
    const group: SidebarMenuItem = { id: "group", label: "Group", type: "itemGroup", children: [] };

    // Act & Assert
    expect(shouldLinkGroupInFlyout(group)).toBe(false);
  });
});

describe("getRailFlyoutChildren", () => {
  it("drops row adornments", () => {
    // Arrange
    const group: SidebarMenuItem = {
      id: "modeling",
      label: "Modeling",
      url: "/models/",
      type: "itemGroup",
      children: [
        { id: "pin", label: "Blog", url: "/models/?pageTypes=1", type: "item", endAdornment: "x" },
      ],
    };

    // Act
    const children = getRailFlyoutChildren(group);

    // Assert
    expect(children[0]?.endAdornment).toBeUndefined();
    expect(children[0]?.label).toBe("Blog");
  });

  it("runs the group click handler from the child that opens the group page", () => {
    // Arrange
    const groupClick = vi.fn();
    const childClick = vi.fn();
    const group: SidebarMenuItem = {
      id: "installed-extensions",
      label: "Extensions",
      url: "/extensions/",
      type: "itemGroup",
      onClick: groupClick,
      children: [
        {
          id: "installed-extensions",
          label: "Installed",
          url: "/extensions/",
          type: "item",
          onClick: childClick,
        },
        { id: "explore-extensions", label: "Explore", url: "/extensions/explore", type: "item" },
      ],
    };

    // Act
    const [installed, explore] = getRailFlyoutChildren(group);

    installed?.onClick?.();
    explore?.onClick?.();

    // Assert
    expect(childClick).toHaveBeenCalledTimes(1);
    expect(groupClick).toHaveBeenCalledTimes(1);
    expect(explore?.onClick).toBeUndefined();
  });
});
