// Adapted from saleor-dashboard: src/components/Sidebar/user/Info.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Our users have no avatar image yet, so the avatar always shows initials.
import { Box, Text } from "@saleor/macaw-ui";

import { useUser } from "../../../auth/AuthProvider";
import { getUserInitials, getUserName } from "../../../misc";
import { savebarHeight } from "../../AppLayout/consts";
import { UserAvatar } from "../../UserAvatar/UserAvatar";
import { UserControls } from "./Controls";

export const UserInfo = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { user } = useUser();

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
      {!collapsed && (
        <Box display="flex" gap={3} alignItems="center" minWidth={0} flexGrow="1">
          {user && (
            <>
              <Box flexShrink="0">
                <UserAvatar initials={getUserInitials(user)} />
              </Box>
              <Box minWidth={0} className="ellipsis">
                <Text size={3} fontWeight="bold">
                  {getUserName(user, true)}
                </Text>
              </Box>
            </>
          )}
        </Box>
      )}
      <UserControls collapsed={collapsed} />
    </Box>
  );
};
