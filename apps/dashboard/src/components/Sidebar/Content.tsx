// Adapted from saleor-dashboard: src/components/Sidebar/Content.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One variant for now: the full sidebar. Saleor's "collapsible" and "rail" variants arrive with
// M0.3.7-M0.3.8, the user footer with M0.3.9; the deprecation banner is omitted.
import { Box } from "@saleor/macaw-ui";
import { MountingPoint } from "./MountingPoint";
import { Menu } from "./menu/Menu";

export const SidebarContent = () => (
  <Box
    backgroundColor="default2"
    as="aside"
    height="100%"
    display="grid"
    __gridTemplateColumns="minmax(0, 1fr)"
    __gridTemplateRows="auto 1fr auto"
  >
    <Box>
      <MountingPoint />
    </Box>
    <Menu />
  </Box>
);
