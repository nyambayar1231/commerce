// Adapted from saleor-dashboard: src/components/Sidebar/Content.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The deprecation banner is omitted.
import { Box } from "@saleor/macaw-ui";
import { MountingPoint } from "./MountingPoint";
import { Menu } from "./menu/Menu";
import { useSidebarCollapse } from "./SidebarContext";
import { UserInfo } from "./user/Info";

/**
 * - `full`: always expanded (the drawer).
 * - `collapsible`: the column, following the viewer's collapse preference.
 * - `rail`: always collapsed, where the full sidebar does not fit beside the page.
 */
export type SidebarContentVariant = "full" | "collapsible" | "rail";

interface SidebarContentProps {
  variant?: SidebarContentVariant;
}

export const SidebarContent = ({ variant = "full" }: SidebarContentProps) => {
  const { isCollapsed } = useSidebarCollapse();
  const collapsed = variant === "rail" || (variant === "collapsible" && isCollapsed);

  return (
    <Box
      backgroundColor="default2"
      as="aside"
      height="100%"
      display="grid"
      __gridTemplateColumns="minmax(0, 1fr)"
      __gridTemplateRows="auto 1fr auto"
    >
      <Box>
        <MountingPoint variant={variant} collapsed={collapsed} />
      </Box>
      <Menu collapsed={collapsed} />
      <UserInfo collapsed={collapsed} />
    </Box>
  );
};
