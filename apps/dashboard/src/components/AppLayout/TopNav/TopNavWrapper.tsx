// Adapted from saleor-dashboard: src/components/AppLayout/TopNav/TopNavWrapper.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type BoxProps } from "@saleor/macaw-ui";
import type * as React from "react";

import { topBarHeight, topBarHeightSubtitle } from "../consts";
import styles from "./TopNavWrapper.module.css";

export const TopNavWrapper = ({
  children,
  withoutBorder,
  hasSubtitle,
  className,
  ...props
}: {
  children?: React.ReactNode;
  withoutBorder?: boolean;
  hasSubtitle?: boolean;
} & BoxProps) => (
  <Box
    className={[styles.root, className].filter(Boolean).join(" ")}
    display={hasSubtitle ? "block" : "flex"}
    alignItems="center"
    paddingY={5}
    borderBottomWidth={withoutBorder ? 0 : 1}
    borderBottomStyle="solid"
    borderColor="default1"
    position="relative"
    data-test-id="page-header"
    __height={hasSubtitle ? topBarHeightSubtitle : topBarHeight}
    gridColumn="8"
    gridRowStart="1"
    backgroundColor="default1"
    {...props}
  >
    {children}
  </Box>
);
