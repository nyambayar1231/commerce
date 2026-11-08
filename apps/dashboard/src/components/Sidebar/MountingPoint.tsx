// Adapted from saleor-dashboard: src/components/Sidebar/MountingPoint.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The sidebar header. Saleor shows its logo image and "Saleor Dashboard"; we show the initials
// of our title (owner decision, PLAN.md M0.3.5), which becomes the shop name in M0.3.10. The
// collapse button arrives in M0.3.7; the Saleor Cloud environment switcher is omitted.
import { Avatar, Box, Text } from "@saleor/macaw-ui";
import { useIntl } from "react-intl";

import { commonMessages } from "../../intl";
import styles from "./MountingPoint.module.css";

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

export const MountingPoint = () => {
  const intl = useIntl();
  const title = intl.formatMessage(commonMessages.dashboard);

  return (
    <Box
      display="flex"
      gap={3}
      alignItems="center"
      className={`${styles.header} ${styles.expandedHeader}`}
    >
      <Avatar.Store initials={getInitials(title)} scheme="accent1" size="small" />
      <Text size={3} fontWeight="bold" __flex="1" className="ellipsis">
        {title}
      </Text>
    </Box>
  );
};
