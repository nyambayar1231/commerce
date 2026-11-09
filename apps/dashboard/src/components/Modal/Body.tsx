// Adapted from saleor-dashboard: src/components/Modal/Body.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type PropsWithBox } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import styles from "./DashboardModal.module.css";
import { MODAL_BODY_DISPLAY_NAME } from "./modalDisplayNames";

type BodyProps = PropsWithBox<{
  children: ReactNode;
  fill?: boolean;
}>;

export const Body = ({ children, className, fill = false, ...rest }: BodyProps) => {
  return (
    <Box
      className={[styles.body, fill && styles.bodyFill, className].filter(Boolean).join(" ")}
      flexGrow="1"
      overflowY="auto"
      __minHeight="0"
      {...rest}
    >
      {children}
    </Box>
  );
};

Body.displayName = MODAL_BODY_DISPLAY_NAME;
