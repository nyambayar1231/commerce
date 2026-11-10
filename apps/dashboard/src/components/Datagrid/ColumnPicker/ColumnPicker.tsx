// Adapted from saleor-dashboard: src/components/Datagrid/ColumnPicker/ColumnPicker.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The column picker's static section only. Saleor's dynamic columns (categories, available-nodes
// search and pagination, the expanded second panel) and its IconButton (not exported by the
// macaw-ui version we ship) are left out; the trigger is a plain button in the same 40px header
// slot.
import { Box, Popover, Text } from "@saleor/macaw-ui";
import { Columns3 } from "lucide-react";
import { useState } from "react";
import { FormattedMessage } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../../icons";
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
}

export const ColumnPicker = ({
  staticColumns,
  selectedColumns,
  onToggle,
  side,
  align,
}: ColumnPickerProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Popover
      modal
      open={pickerOpen}
      onOpenChange={() => setPickerOpen((isPickerOpen) => !isPickerOpen)}
    >
      <Popover.Trigger>
        <button
          type="button"
          className={styles.trigger}
          data-test-id="open-column-picker-button"
          title="Pick columns"
          aria-label="Pick columns"
        >
          <Columns3 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
        </button>
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
