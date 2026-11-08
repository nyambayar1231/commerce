// Adapted from saleor-dashboard: src/components/Sidebar/followSidebarLink.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// React Router 7: `navigate` and the current location replace v5's `history`. We mount at "/",
// so Saleor's APP_MOUNT_URI stripping is gone and every same-origin link is an app page.
interface LinkClick {
  button: number;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
}

/** The one call we make; React Router's `navigate` satisfies it. */
export type SidebarNavigate = (to: string, options: { replace: boolean }) => void;

interface CurrentLocation {
  pathname: string;
  search: string;
  hash: string;
}

const isPlainLeftClick = (event: LinkClick): boolean =>
  event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;

const getClickedAnchor = (event: LinkClick): HTMLAnchorElement | null => {
  if (!isPlainLeftClick(event) || !(event.target instanceof Element)) {
    return null;
  }

  const anchor = event.target.closest("a");

  if (!(anchor instanceof HTMLAnchorElement) || !anchor.href || anchor.target === "_blank") {
    return null;
  }

  return anchor.origin === window.location.origin ? anchor : null;
};

/**
 * Follows a menu link through the router. The collapsed submenu unmounts the link while
 * the click is still in progress, and the browser would otherwise load the page from scratch.
 */
export const followSidebarLink = (
  event: LinkClick,
  navigate: SidebarNavigate,
  location: CurrentLocation,
): boolean => {
  const anchor = getClickedAnchor(event);

  if (!anchor) {
    return false;
  }

  event.preventDefault();

  const path = `${anchor.pathname}${anchor.search}${anchor.hash}`;
  const { pathname, search, hash } = location;

  navigate(path, { replace: path === `${pathname}${search}${hash}` });

  return true;
};
