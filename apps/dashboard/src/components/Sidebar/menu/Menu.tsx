// Adapted from saleor-dashboard: src/components/Sidebar/menu/Menu.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The collapsed rail (RailMenuItem, RailTooltipGroup) arrives in M0.3.7; Saleor's shortcuts and
// feedback button are omitted (PLAN.md M0.3.5).
import { Box, List } from "@saleor/macaw-ui";

import { useMenuStructure } from "./hooks/useMenuStructure";
import { MenuItem } from "./Item";

export const Menu = () => {
  const menuStructure = useMenuStructure();

  return (
    <Box
      padding={3}
      overflowY="auto"
      className="hide-scrollbar"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      <List as="ol" display="grid" gap={1} data-test-id="menu-list">
        {menuStructure.map((menuItem) => (
          <MenuItem menuItem={menuItem} key={menuItem.id} />
        ))}
      </List>
    </Box>
  );
};
