// Copied from saleor-dashboard: src/components/Layouts/Detail/Content.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type BoxProps } from "@saleor/macaw-ui";
import type * as React from "react";

interface DetailPageLayoutContentProps extends BoxProps {
  [key: `data-${string}`]: string;
  children: React.ReactNode;
  hideScrollbar?: boolean;
}

export const Content = ({
  children,
  hideScrollbar = true,
  ...rest
}: DetailPageLayoutContentProps) => {
  return (
    <Box
      height="100%"
      overflowY="auto"
      className={hideScrollbar ? "hide-scrollbar" : ""}
      gridColumn="8"
      gridRow={{ mobile: "6", tablet: "12", desktop: "12" }}
      {...rest}
      data-detail-content-scroll="true"
    >
      {children}
    </Box>
  );
};
