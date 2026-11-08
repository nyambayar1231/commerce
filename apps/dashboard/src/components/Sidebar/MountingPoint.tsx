// Adapted from saleor-dashboard: src/components/Sidebar/MountingPoint.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The sidebar header. Saleor shows its logo image and "Saleor Dashboard"; we show the initials
// of our title (owner decision, PLAN.md M0.3.5), which becomes the shop name in M0.3.10. The
// rail's drawer trigger arrives in M0.3.8; the Saleor Cloud environment switcher is omitted.
import { Avatar, Box, Text } from "@saleor/macaw-ui";
import { useIntl } from "react-intl";

import { commonMessages } from "../../intl";
import type { SidebarContentVariant } from "./Content";
import styles from "./MountingPoint.module.css";
import { SidebarCollapseButton, SidebarExpandButton } from "./SidebarCollapseToggle";

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

interface MountingPointProps {
  variant: SidebarContentVariant;
  collapsed: boolean;
}

export const MountingPoint = ({ variant, collapsed }: MountingPointProps) => {
  const intl = useIntl();
  const title = intl.formatMessage(commonMessages.dashboard);
  const initials = getInitials(title);

  if (collapsed) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" className={styles.header}>
        <SidebarExpandButton initials={initials} />
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      gap={3}
      alignItems="center"
      className={`${styles.header} ${styles.expandedHeader}`}
    >
      <Avatar.Store initials={initials} scheme="accent1" size="small" />
      <Text size={3} fontWeight="bold" __flex="1" className="ellipsis">
        {title}
      </Text>
      {variant === "collapsible" && <SidebarCollapseButton />}
    </Box>
  );
};
