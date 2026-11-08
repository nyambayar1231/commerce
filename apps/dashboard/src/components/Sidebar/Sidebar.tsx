// Adapted from saleor-dashboard: src/components/Sidebar/Sidebar.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only Saleor's "column" layout so far, at every width; the rail and drawer layouts arrive in
// M0.3.8. The ripples modal, search hotkey and analytics are omitted.
import { useEffect } from "react";

import { SidebarContent } from "./Content";
import classes from "./Sidebar.module.css";
import { useSidebarCollapse } from "./SidebarContext";
import { useSidebarCollapseToggle } from "./useSidebarCollapseToggle";

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

export const Sidebar = () => <PersistentSidebar />;
