// Copied from saleor-dashboard: src/components/Layouts/List/Root.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";
import type * as React from "react";

interface ListPageLayoutProps {
  children: React.ReactNode;
  hasSaveBar?: boolean;
  hasTopNav?: boolean;
}

export const ListPageLayout = ({ children }: ListPageLayoutProps) => (
  <Box
    display="grid"
    __gridTemplateColumns="minmax(0, 1fr)"
    __gridTemplateRows="auto 1fr"
    height="100%"
  >
    {children}
  </Box>
);
