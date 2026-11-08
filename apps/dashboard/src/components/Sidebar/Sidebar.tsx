// Adapted from saleor-dashboard: src/components/Sidebar/Sidebar.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The ripples modal, search hotkey and analytics are omitted.
import { Drawer } from "@saleor/macaw-ui";
import { useEffect } from "react";

import { SidebarContent } from "./Content";
import classes from "./Sidebar.module.css";
import { SidebarAppBar } from "./SidebarAppBar";
import { useSidebarBreakpointContext, useSidebarCollapse } from "./SidebarContext";
import { SidebarDrawerContent, useDrawerRemount } from "./SidebarDrawer";
import { useSidebarBrand } from "./useSidebarBrand";
import { useSidebarCollapseToggle } from "./useSidebarCollapseToggle";
import { type SidebarLayout, useSidebarLayout } from "./useSidebarLayout";

const isMac = (): boolean => navigator.appVersion.toLowerCase().includes("mac");

/** Like react-hotkeys-hook (Saleor's choice), shortcuts don't fire while typing in a field. */
const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Saleor's `useHotkeys("mod+b", …)`: ⌘B on macOS, Ctrl+B elsewhere. */
const useCollapseShortcut = (toggle: () => void): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = isMac() ? event.metaKey : event.ctrlKey;

      if (!mod || event.altKey || event.shiftKey || event.key.toLowerCase() !== "b") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);
};

const PersistentSidebar = () => {
  const { isCollapsed } = useSidebarCollapse();
  const toggleCollapsed = useSidebarCollapseToggle();

  useCollapseShortcut(toggleCollapsed);

  return (
    <div className={classes.column} data-collapsed={isCollapsed} data-test-id="sidebar-column">
      <div className={classes.columnContent}>
        <SidebarContent variant="collapsible" />
      </div>
    </div>
  );
};

/** The logo in the rail is the drawer trigger, so the full navigation opens over the page. */
const RailSidebar = () => {
  const drawer = useDrawerRemount();

  return (
    <Drawer key={drawer.key}>
      <div className={classes.column} data-collapsed data-test-id="sidebar-rail">
        <div className={classes.columnContent}>
          <SidebarContent variant="rail" />
        </div>
      </div>
      <SidebarDrawerContent onClose={drawer.close}>
        <SidebarContent />
      </SidebarDrawerContent>
    </Drawer>
  );
};

const DrawerSidebar = () => {
  const drawer = useDrawerRemount();
  const { title, initials } = useSidebarBrand();

  return (
    <Drawer key={drawer.key}>
      <SidebarAppBar title={title} initials={initials} />
      <SidebarDrawerContent onClose={drawer.close}>
        <SidebarContent />
      </SidebarDrawerContent>
    </Drawer>
  );
};

const SidebarForLayout = ({ layout }: { layout: SidebarLayout }) => {
  switch (layout) {
    case "column":
      return <PersistentSidebar />;
    case "rail":
      return <RailSidebar />;
    case "drawer":
      return <DrawerSidebar />;
    default: {
      const exhaustive: never = layout;

      return exhaustive;
    }
  }
};

export const Sidebar = () => {
  const { breakpoint } = useSidebarBreakpointContext();
  const layout = useSidebarLayout(breakpoint);

  return <SidebarForLayout layout={layout} />;
};
