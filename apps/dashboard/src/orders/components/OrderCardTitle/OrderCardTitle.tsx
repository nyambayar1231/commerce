// Adapted from saleor-dashboard: src/orders/components/OrderCardTitle/OrderCardTitle.tsx and
// OrderCardDatagridSeparator.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's order card title (16px above, the card's 32px sides) with an optional toolbar, and the
// dashed separator above a lines grid. Only what the draft's "Order lines" card uses so far: the
// title text is passed in (Saleor picks it from the fulfillment status), no status indicator or
// eyebrow (date, warehouse, tracking number).
import { Box, Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import styles from "./OrderCardTitle.module.css";

interface OrderCardTitleProps {
  title: ReactNode;
  toolbar?: ReactNode;
}

export const OrderCardTitle = ({ title, toolbar }: OrderCardTitleProps) => (
  <Box className={styles.header} backgroundColor="default1">
    <Box className={styles.titleRow}>
      <Box className={styles.title}>
        <Text size={6} fontWeight="medium">
          {title}
        </Text>
      </Box>
      {toolbar && <Box className={styles.toolbar}>{toolbar}</Box>}
    </Box>
  </Box>
);

export const OrderCardDatagridSeparator = () => (
  <hr className={styles.datagridSeparator} aria-hidden />
);
