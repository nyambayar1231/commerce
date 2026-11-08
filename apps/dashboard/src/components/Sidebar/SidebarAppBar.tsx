// Adapted from saleor-dashboard: src/components/Sidebar/SidebarAppBar.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Initials and our title instead of Saleor's logo and name; no search button (not on the roadmap).
import { Avatar, Drawer, Text } from "@saleor/macaw-ui";
import { Menu } from "lucide-react";
import { useIntl } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../icons";

import styles from "./SidebarAppBar.module.css";
import { sidebarDrawerTriggerMessages } from "./sidebarDrawerTriggerMessages";

// Centred in a 44px target, a 20px icon lands on the 12px inset of phone page headers.
const appBarIconProps = {
  size: iconSize.medium,
  strokeWidth: iconStrokeWidthBySize.medium,
} as const;

interface SidebarAppBarProps {
  title: string;
  initials: string;
}

/** Phone-width header: the navigation opens in the drawer. */
export const SidebarAppBar = ({ title, initials }: SidebarAppBarProps) => {
  const intl = useIntl();

  return (
    <header className={styles.appBar} data-test-id="sidebar-app-bar">
      <Drawer.Trigger>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={intl.formatMessage(sidebarDrawerTriggerMessages.openNavigation)}
          data-test-id="sidebar-drawer-open"
        >
          <Menu {...appBarIconProps} aria-hidden />
        </button>
      </Drawer.Trigger>
      <div className={styles.brand}>
        <Avatar.Store initials={initials} scheme="accent1" size="small" />
        <Text size={3} fontWeight="bold" className="ellipsis">
          {title}
        </Text>
      </div>
    </header>
  );
};
