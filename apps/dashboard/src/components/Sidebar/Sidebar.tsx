// Adapted from saleor-dashboard: src/components/Sidebar/Sidebar.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only Saleor's "column" layout so far, at every width. Collapsing (M0.3.7) and the rail and
// drawer layouts (M0.3.8) follow; the ripples modal, search hotkey and analytics are omitted.
import { SidebarContent } from "./Content";
import classes from "./Sidebar.module.css";
import { useSidebarCollapse } from "./SidebarContext";

const PersistentSidebar = () => {
  const { isCollapsed } = useSidebarCollapse();

  return (
    <div className={classes.column} data-collapsed={isCollapsed} data-test-id="sidebar-column">
      <div className={classes.columnContent}>
        <SidebarContent />
      </div>
    </div>
  );
};

export const Sidebar = () => <PersistentSidebar />;
