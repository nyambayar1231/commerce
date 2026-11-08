// Adapted from saleor-dashboard: src/components/Sidebar/menu/SubmenuItems.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor puts a separator before "settings" sub-items (e.g. Product Types); we have none yet.
import { MenuItem } from "./Item";
import type { SidebarMenuItem } from "./types";

export const SubmenuItems = ({ items }: { items: SidebarMenuItem[] }) => (
  <>
    {items.map((child) => (
      <MenuItem menuItem={child} key={child.id} />
    ))}
  </>
);
