// Adapted from saleor-dashboard: src/components/Sidebar/MountingPoint.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The sidebar header. Saleor shows its logo image and "Saleor Dashboard"; we show initials and our
// title (useSidebarBrand). The Saleor Cloud environment switcher is omitted.
import { Avatar, Box, Text } from "@saleor/macaw-ui";

import type { SidebarContentVariant } from "./Content";
import styles from "./MountingPoint.module.css";
import {
  SidebarCollapseButton,
  SidebarDrawerOpenButton,
  SidebarExpandButton,
} from "./SidebarCollapseToggle";
import { useSidebarBrand } from "./useSidebarBrand";

interface MountingPointProps {
  variant: SidebarContentVariant;
  collapsed: boolean;
}

export const MountingPoint = ({ variant, collapsed }: MountingPointProps) => {
  const { title, initials } = useSidebarBrand();

  if (collapsed) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" className={styles.header}>
        {variant === "rail" ? (
          <SidebarDrawerOpenButton initials={initials} />
        ) : (
          <SidebarExpandButton initials={initials} />
        )}
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
