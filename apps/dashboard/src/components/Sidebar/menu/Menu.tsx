// Adapted from saleor-dashboard: src/components/Sidebar/menu/Menu.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's shortcuts and feedback button are omitted (PLAN.md M0.3.5).
import { Box, List } from "@saleor/macaw-ui";

import { useMenuStructure } from "./hooks/useMenuStructure";
import { MenuItem } from "./Item";
import { RailMenuItem } from "./RailMenuItem";
import { RailTooltipGroup } from "./RailTooltipGroup";

export const Menu = ({ collapsed = false }: { collapsed?: boolean }) => {
  const menuStructure = useMenuStructure();

  return (
    <RailTooltipGroup>
      <Box
        padding={3}
        overflowY="auto"
        className="hide-scrollbar"
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
      >
        <List as="ol" display="grid" gap={1} data-test-id="menu-list">
          {menuStructure.map((menuItem) =>
            collapsed ? (
              <RailMenuItem menuItem={menuItem} key={menuItem.id} />
            ) : (
              <MenuItem menuItem={menuItem} key={menuItem.id} />
            ),
          )}
        </List>
      </Box>
    </RailTooltipGroup>
  );
};
