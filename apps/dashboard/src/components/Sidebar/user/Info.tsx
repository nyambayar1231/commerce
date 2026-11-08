// Adapted from saleor-dashboard: src/components/Sidebar/user/Info.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The avatar and name arrive with users (M1); their slot stays so the controls sit on the right.
import { Box } from "@saleor/macaw-ui";

import { savebarHeight } from "../../AppLayout/consts";
import { UserControls } from "./Controls";

export const UserInfo = ({ collapsed = false }: { collapsed?: boolean }) => {
  return (
    <Box
      display="flex"
      gap={3}
      paddingX={3}
      // Centers the 32px avatar on the menu icon axis, where the collapsed rail centers it.
      __paddingLeft={collapsed ? undefined : "calc(var(--sidebar-icon-axis, 30px) - 16px)"}
      alignItems="center"
      borderTopWidth={1}
      borderColor="default1"
      borderTopStyle="solid"
      justifyContent={collapsed ? "center" : "space-between"}
      // Match savebarHeight so this hairline meets the save bar across the sidebar edge.
      __height={savebarHeight}
    >
      {!collapsed && <Box display="flex" gap={3} alignItems="center" minWidth={0} flexGrow="1" />}
      <UserControls collapsed={collapsed} />
    </Box>
  );
};
