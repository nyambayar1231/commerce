// Adapted from saleor-dashboard: src/components/Sidebar/user/Controls.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ⋯ account menu: the signed-in header (rail only), Log out and the theme item.
// Account Settings returns with the staff detail page (admin phase); the feedback button, Features
// preview and "Go to Saleor Cloud" are omitted.
import { Box, Button, Dropdown, List, Text } from "@saleor/macaw-ui";
import { EllipsisVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { useUser } from "../../../auth/AuthProvider";
import { getUserInitials, getUserName } from "../../../misc";
import { useTheme } from "../../../theme/hook";
import { navigationLucideIconProps } from "../../icons";
import { UserAvatar } from "../../UserAvatar/UserAvatar";
import { sidebarCollapseMessages } from "../sidebarCollapseMessages";
import styles from "./Controls.module.css";
import { ThemeSwitcher } from "./ThemeSwitcher";

// Saleor's useLegacyThemeHandler, without the legacy macaw-ui 0.7 theme it also switched.
export const useThemeHandler = () => {
  const { theme, setTheme } = useTheme();
  const changeTheme = () => {
    setTheme(theme === "defaultLight" ? "defaultDark" : "defaultLight");
  };
  // Another tab changed the theme: follow it.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== "activeMacawUITheme") {
      return;
    }

    const isDark = event.newValue?.toLowerCase().includes("dark");

    setTheme(isDark ? "defaultDark" : "defaultLight");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: subscribe once, as Saleor does.
  useEffect(() => {
    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return { changeTheme, theme };
};

/**
 * `collapsed` is the icon rail: the avatar opens the menu, which then also shows who is signed
 * in, since the rail has no room for the name.
 */
export const UserControls = ({ collapsed = false }: { collapsed?: boolean }) => {
  const intl = useIntl();
  const { user, logout } = useUser();
  const { changeTheme, theme } = useThemeHandler();
  const [open, setOpen] = useState(false);

  return (
    <Box display="flex" alignItems="center" gap={1} flexShrink="0">
      <Dropdown
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
        }}
      >
        <Dropdown.Trigger>
          {collapsed ? (
            <button
              type="button"
              className={styles.avatarTrigger}
              data-test-id="userMenu"
              aria-label={intl.formatMessage(sidebarCollapseMessages.accountMenu)}
            >
              {user && <UserAvatar initials={getUserInitials(user)} />}
            </button>
          ) : (
            <Button
              variant="tertiary"
              icon={<EllipsisVertical {...navigationLucideIconProps} />}
              // Ours, not Saleor's: Saleor names only the rail trigger.
              aria-label={intl.formatMessage(sidebarCollapseMessages.accountMenu)}
              data-test-id="userMenu"
              size="medium"
              onClick={() => setOpen(true)}
            />
          )}
        </Dropdown.Trigger>
        <Dropdown.Content align="end" side={collapsed ? "right" : undefined}>
          <Box __minWidth={192} className={collapsed ? styles.railMenu : undefined}>
            <List
              padding={2}
              borderRadius={4}
              boxShadow="defaultOverlay"
              backgroundColor="default1"
            >
              {collapsed && user && (
                <Box
                  paddingX={1.5}
                  paddingTop={1.5}
                  paddingBottom={2}
                  marginBottom={1}
                  borderBottomWidth={1}
                  borderBottomStyle="solid"
                  borderColor="default1"
                  display="grid"
                  __maxWidth={240}
                >
                  <Text size={3} fontWeight="medium" className="ellipsis">
                    {getUserName(user, true)}
                  </Text>
                  <Text size={2} color="default2" className="ellipsis">
                    {user.email}
                  </Text>
                </Box>
              )}
              <Dropdown.Item>
                <List.Item
                  onClick={() => void logout()}
                  {...listItemStyles}
                  data-test-id="log-out-button"
                >
                  <Text>
                    <FormattedMessage id="qLbse5" defaultMessage="Log out" description="button" />
                  </Text>
                </List.Item>
              </Dropdown.Item>
              <Dropdown.Item>
                <List.Item
                  display="flex"
                  alignItems="center"
                  __lineHeight={0}
                  gap={1.5}
                  marginTop={1}
                  onClick={() => {
                    changeTheme();
                    setOpen(false);
                  }}
                  {...listItemStyles}
                  data-test-id="theme-switch"
                >
                  <ThemeSwitcher theme={theme} />
                </List.Item>
              </Dropdown.Item>
            </List>
          </Box>
        </Dropdown.Content>
      </Dropdown>
    </Box>
  );
};

const listItemStyles = {
  paddingX: 1.5,
  paddingY: 2,
  borderRadius: 4,
} as const;
