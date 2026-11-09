// Adapted from saleor-dashboard: src/components/TablePagination/DatagridPagination.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";

import { TablePagination } from "./TablePagination";

/** Pagination wrapper with consistent padding for Datagrid layouts */
export const DatagridPagination = (props: ComponentProps<typeof TablePagination>) => (
  <Box paddingX={6} __paddingTop="15px" paddingBottom={4}>
    <TablePagination {...props} />
  </Box>
);
