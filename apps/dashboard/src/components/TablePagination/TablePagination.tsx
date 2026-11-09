// Adapted from saleor-dashboard: src/components/TablePagination/TablePagination.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The "No. of rows" select plus previous/next buttons. Saleor's row-number select is the legacy
// macaw-ui (MUI) PaginationRowNumberSelect, which we don't ship; this is the same label + select
// with Macaw 3's Select. Saleor's Table-cell wrapper (`component`/`colSpan`) is left out: our
// lists are Datagrids.
import { Box, Select, Text } from "@saleor/macaw-ui";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import type { ListSettings, ListSettingsUpdate } from "../../hooks/useListSettings";
import { commonMessages } from "../../intl";
import { PaginationButtons } from "../PaginationButtons/PaginationButtons";

export interface PaginationProps {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  /** Settings object (for context-based pagination) */
  settings?: ListSettings;
  /** Callback to update settings (for context-based pagination) */
  onUpdateListSettings?: ListSettingsUpdate;
  prevHref?: string;
  nextHref?: string;
  disabled?: boolean;
}

const choices = [10, 20, 30, 50, 100];
const options = choices.map((value) => ({ label: String(value), value: String(value) }));

export const TablePagination = ({
  settings,
  onUpdateListSettings,
  nextHref,
  prevHref,
  hasNextPage,
  hasPreviousPage,
  disabled,
  onNextPage,
  onPreviousPage,
}: PaginationProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const handlers = {
    onPreviousPage: prevHref ? () => navigate(prevHref) : onPreviousPage,
    onNextPage: nextHref ? () => navigate(nextHref) : onNextPage,
  };
  const rowNumber = settings?.rowNumber;

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      {rowNumber ? (
        <Box display="flex" alignItems="center" gap={2} data-test-id="pagination-row-number">
          <Text size={2} color="default2">
            {intl.formatMessage(commonMessages.noOfRows)}
          </Text>
          <Box __width="80px">
            <Select
              size="small"
              options={options}
              disabled={disabled}
              value={options.find((option) => option.value === String(rowNumber)) ?? null}
              onChange={(option) =>
                option && onUpdateListSettings?.("rowNumber", Number(option.value))
              }
            />
          </Box>
        </Box>
      ) : (
        <Box />
      )}
      <Box display="flex" flexDirection="row" alignItems="center" gap={2}>
        <PaginationButtons
          hasPreviousPage={hasPreviousPage}
          hasNextPage={hasNextPage}
          disabled={disabled}
          onPreviousPage={handlers.onPreviousPage}
          onNextPage={handlers.onNextPage}
        />
      </Box>
    </Box>
  );
};
