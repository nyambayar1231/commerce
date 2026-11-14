// Adapted from saleor-dashboard: src/components/Datagrid/ColumnPicker/ColumnPicker.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The column picker's static section only. Saleor's dynamic columns (categories, available-nodes
// search and pagination, the expanded second panel) and its IconButton (not exported by the
// macaw-ui version we ship) are left out; the trigger is a plain button on Saleor's 39×40 box
// (`backgroundColor`, default1 as Saleor), which hides the header text scrolled under it.
import { Box, Popover, Text, type vars } from "@saleor/macaw-ui";
import { Columns3 } from "lucide-react";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../../icons";
import { cellHeight } from "../styles";
import type { AvailableColumn } from "../types";
import styles from "./ColumnPicker.module.css";
import { ColumnPickerStaticColumns } from "./ColumnPickerStaticColumns";
import messages from "./messages";

interface ColumnPickerProps {
  staticColumns: AvailableColumn[];
  selectedColumns: string[];
  onToggle: (columnId: string) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  backgroundColor?: keyof typeof vars.colors.background;
}

export const ColumnPicker = ({
  staticColumns,
  selectedColumns,
  onToggle,
  side,
  align,
  backgroundColor = "default1",
}: ColumnPickerProps) => {
  const intl = useIntl();
  // Ours: Saleor leaves this label in English (M11.3).
  const pickColumns = intl.formatMessage({
    id: "KzcNvP",
    defaultMessage: "Pick columns",
    description: "column picker button label",
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Popover
      modal
      open={pickerOpen}
      onOpenChange={() => setPickerOpen((isPickerOpen) => !isPickerOpen)}
    >
      <Popover.Trigger>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          __width={cellHeight - 1}
          __height={cellHeight}
          backgroundColor={backgroundColor}
        >
          <button
            type="button"
            className={styles.trigger}
            data-test-id="open-column-picker-button"
            title={pickColumns}
            aria-label={pickColumns}
          >
            <Columns3 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
          </button>
        </Box>
      </Popover.Trigger>
      <Popover.Content className={styles.popover} align={align} side={side}>
        <Box
          __width="320px"
          __maxHeight="50vh"
          backgroundColor="default1"
          padding={4}
          overflow="scroll"
        >
          <Box marginBottom={3}>
            <Text size={1} color="default2">
              <FormattedMessage {...messages.column} />
            </Text>
          </Box>
          <ColumnPickerStaticColumns
            staticColumns={staticColumns}
            handleToggle={onToggle}
            selectedColumns={selectedColumns}
          />
        </Box>
      </Popover.Content>
    </Popover>
  );
};
