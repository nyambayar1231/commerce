// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/Row.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One filter row: left operand combobox, condition select, right-hand control and remove button.
// Saleor's left operand is a DynamicCombobox whose typed text queries attributes; with static
// operands only, the typed text filters them locally. Attribute/constraint hints, swatches and
// the inline layout are dropped.
import { Box, Button, DynamicCombobox, Select } from "@saleor/macaw-ui";
import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { iconSize, iconStrokeWidth } from "../../icons";
import type { ConditionItem } from "../FilterElement/ConditionOptions";
import type { FilterEventEmitter } from "./EventEmitter";
import type { ErrorLookup } from "./errors";
import { getFilterControlId } from "./filterControlId";
import { RightOperator } from "./RightOperator";
import type { ConditionalFiltersLayout } from "./Root";
import styles from "./Row.module.css";
import { getGridTemplateColumns } from "./rowGrid";
import type { LeftOperatorOption, Row } from "./types";

interface RowProps {
  item: Row;
  index: number;
  leftOptions: LeftOperatorOption[];
  emitter: FilterEventEmitter;
  error: ErrorLookup[number];
  layout?: ConditionalFiltersLayout;
}

export const RowComponent = ({
  item,
  index,
  leftOptions,
  emitter,
  error,
  layout = "panel",
}: RowProps): React.ReactNode => {
  // A row carried over from the URL (category) is not in the "add" list; keep its current
  // operand selectable so the select can show its label.
  const operands = useMemo(() => {
    if (leftOptions.some((option) => option.value === item.value.value)) {
      return leftOptions;
    }

    return [
      {
        label: item.value.label,
        value: item.value.value,
        type: item.value.type,
        slug: item.value.value,
      },
      ...leftOptions,
    ];
  }, [leftOptions, item.value]);
  const [query, setQuery] = useState("");
  const visibleOperands = useMemo(() => {
    const needle = query.trim().toLowerCase();

    // The input shows the selected label after a pick; that text must not hide the others.
    return needle === "" || needle === item.value.label.toLowerCase()
      ? operands
      : operands.filter((operand) => operand.label.toLowerCase().includes(needle));
  }, [operands, query, item.value.label]);

  return (
    <Box
      className={styles.row}
      display="grid"
      gap={2}
      __gridTemplateColumns={getGridTemplateColumns(layout)}
      placeItems="flex-start"
      alignItems="center"
      width="100%"
      __minWidth="0"
    >
      <DynamicCombobox
        id={getFilterControlId("left", index)}
        data-test-id={`left-${index}`}
        value={operands.find((operand) => operand.value === item.value.value) ?? null}
        options={visibleOperands}
        onInputValueChange={setQuery}
        onChange={(value) => {
          if (!value) return;

          const option = operands.find((operand) => operand.value === value.value);

          if (option) {
            emitter.changeLeftOperator(index, option);
          }
        }}
        error={error.left.show}
        helperText={error.left.text}
      />

      <Select
        id={getFilterControlId("condition", index)}
        data-test-id={`condition-${index}`}
        value={item.condition.selected.conditionValue}
        options={item.condition.options}
        onChange={(value) => {
          if (value) {
            emitter.changeCondition(index, value as ConditionItem);
          }
        }}
        error={error.condition.show}
        helperText={error.condition.text}
      />

      <div className={styles.valueField}>
        <RightOperator
          selected={item.condition.selected}
          index={index}
          emitter={emitter}
          error={error.right.show}
          helperText={error.right.text}
        />
      </div>

      <Button
        marginLeft="auto"
        variant="tertiary"
        aria-label="Remove condition"
        data-test-id={`remove-row-${index}`}
        icon={<X size={iconSize.medium} strokeWidth={iconStrokeWidth} />}
        onClick={() => emitter.removeRow(index)}
      />
    </Box>
  );
};
