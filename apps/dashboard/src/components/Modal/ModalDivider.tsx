// Adapted from saleor-dashboard: src/components/Modal/ModalDivider.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";

import styles from "./DashboardModal.module.css";
import { MODAL_DIVIDER_DISPLAY_NAME } from "./modalDisplayNames";

export const ModalDivider = () => {
  return (
    <Box
      className={styles.fullBleedDivider}
      width="100%"
      height="px"
      backgroundColor="default3"
      borderWidth={0}
      flexShrink="0"
    />
  );
};

ModalDivider.displayName = MODAL_DIVIDER_DISPLAY_NAME;
