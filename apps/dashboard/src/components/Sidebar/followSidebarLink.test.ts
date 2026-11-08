// @vitest-environment jsdom
// Adapted from saleor-dashboard: src/components/Sidebar/followSidebarLink.test.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A mock `navigate` stands in for v5's memory history. Saleor's mount-path cases are dropped
// (we mount at "/").
import { afterEach, describe, expect, it, vi } from "vitest";

import { followSidebarLink, type SidebarNavigate } from "./followSidebarLink";

interface ClickResult {
  followed: boolean;
  defaultPrevented: boolean;
}

const at = (pathname: string) => ({ pathname, search: "", hash: "" });

const clickLink = (
  html: string,
  navigate: SidebarNavigate,
  location = at("/home"),
): ClickResult => {
  document.body.innerHTML = html;

  const anchor = document.querySelector("a");
  let result: ClickResult = { followed: false, defaultPrevented: false };

  anchor?.addEventListener("click", (event) => {
    const followed = followSidebarLink(event, navigate, location);

    result = { followed, defaultPrevented: event.defaultPrevented };
    // jsdom does not load pages; stop it from logging a navigation error.
    event.preventDefault();
  });
  anchor?.click();

  return result;
};

describe("followSidebarLink", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens an app page through the router instead of loading it", () => {
    // Arrange
    const navigate = vi.fn<SidebarNavigate>();

    // Act
    const result = clickLink('<a href="/orders">Orders</a>', navigate);

    // Assert
    expect(result).toEqual({ followed: true, defaultPrevented: true });
    expect(navigate).toHaveBeenCalledWith("/orders", { replace: false });
  });

  it("replaces the entry when the link points to the current page", () => {
    // Arrange
    const navigate = vi.fn<SidebarNavigate>();

    // Act
    clickLink('<a href="/orders">Orders</a>', navigate, at("/orders"));

    // Assert
    expect(navigate).toHaveBeenCalledWith("/orders", { replace: true });
  });

  it("keeps the query string and hash", () => {
    // Arrange
    const navigate = vi.fn<SidebarNavigate>();

    // Act
    clickLink('<a href="/orders?status=paid#top">Orders</a>', navigate);

    // Assert
    expect(navigate).toHaveBeenCalledWith("/orders?status=paid#top", { replace: false });
  });

  it.each([
    ["a new-tab link", '<a href="/orders" target="_blank">Orders</a>'],
    ["another site", '<a href="https://cloud.saleor.io/">Cloud</a>'],
  ])("leaves %s to the browser", (_, html) => {
    // Arrange
    const navigate = vi.fn<SidebarNavigate>();

    // Act
    const result = clickLink(html, navigate);

    // Assert
    expect(result).toEqual({ followed: false, defaultPrevented: false });
    expect(navigate).not.toHaveBeenCalled();
  });
});
