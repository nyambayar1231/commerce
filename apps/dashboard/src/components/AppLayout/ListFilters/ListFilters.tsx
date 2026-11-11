// Adapted from saleor-dashboard: src/components/AppLayout/ListFilters/ListFilters.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The toolbar above a list: Filters button, our ListSearchInput, then the filter panel. Saleor's
// legacy-presets alert and search tooltip are dropped; the trailing `actions` slot holds list
// actions such as the product list's bulk delete button.
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import { ListSearchInput } from "../../ListSearchInput/ListSearchInput";
import { ExpressionFilterPanel, ExpressionFilters } from "./components/ExpressionFilters";

interface ListFiltersProps {
  initialSearch: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  actions?: ReactNode;
}

export const ListFilters = ({
  initialSearch,
  searchPlaceholder,
  onSearchChange,
  actions,
}: ListFiltersProps): ReactNode => (
  <Box display="flex" flexDirection="column" gap={3} paddingBottom={2} paddingX={6}>
    <Box display="grid" __gridTemplateColumns="auto 1fr" gap={4}>
      <Box display="flex" alignItems="center" gap={4}>
        <ExpressionFilters />
        <Box __width="360px">
          <ListSearchInput
            initialSearch={initialSearch}
            placeholder={searchPlaceholder}
            onSearchChange={onSearchChange}
          />
        </Box>
      </Box>
      <Box display="flex" justifyContent="flex-end" alignItems="center">
        {actions}
      </Box>
    </Box>
    <ExpressionFilterPanel />
  </Box>
);
