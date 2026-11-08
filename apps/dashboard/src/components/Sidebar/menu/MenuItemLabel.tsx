// Adapted from saleor-dashboard: src/components/Sidebar/menu/MenuItemLabel.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Text } from "@saleor/macaw-ui";

import type { SidebarMenuItem } from "./types";

interface MenuItemLabelProps {
  menuItem: SidebarMenuItem;
}

// Custom ReactNode labels must set their own typography (see Search / Extensions items).
export const MenuItemLabel = ({ menuItem }: MenuItemLabelProps) => {
  if (typeof menuItem.label !== "string") {
    return <>{menuItem.label}</>;
  }

  if (menuItem.labelStyle === "settings") {
    return (
      <Text size={2} fontWeight="regular" color="default2">
        {menuItem.label}
      </Text>
    );
  }

  return (
    <Text size={3} fontWeight="medium">
      {menuItem.label}
    </Text>
  );
};
