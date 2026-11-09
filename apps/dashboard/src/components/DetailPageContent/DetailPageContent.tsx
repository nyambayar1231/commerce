// Adapted from saleor-dashboard: src/components/DetailPageContent/DetailPageContent.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type BoxProps } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import styles from "./DetailPageContent.module.css";

interface DetailPageContentProps extends Omit<BoxProps, "children"> {
  children: ReactNode;
}

/**
 * Main-column stack for entity detail pages without a section nav rail.
 * Applies shared padding and vertical gap between DetailSettingsCard / SEO / list sections.
 */
export const DetailPageContent = ({
  children,
  className,
  ...rest
}: DetailPageContentProps): ReactNode => (
  <Box
    className={[styles.root, className].filter(Boolean).join(" ")}
    display="flex"
    flexDirection="column"
    gap={4}
    paddingTop={6}
    paddingBottom={6}
    {...rest}
  >
    {children}
  </Box>
);
