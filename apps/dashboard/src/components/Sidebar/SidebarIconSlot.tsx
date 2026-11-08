// Adapted from saleor-dashboard: src/components/Sidebar/SidebarIconSlot.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";

const SIDEBAR_ICON_SLOT_SIZE = 20;

export const SidebarIconSlot = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <Box
    color="default2"
    display="flex"
    alignItems="center"
    justifyContent="center"
    __flexShrink={0}
    __width={SIDEBAR_ICON_SLOT_SIZE}
    __height={SIDEBAR_ICON_SLOT_SIZE}
  >
    {children}
  </Box>
);
