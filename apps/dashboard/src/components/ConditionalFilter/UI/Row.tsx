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
import { useIntl } from "react-intl";

import { iconSize, iconStrokeWidth } from "../../icons";
import {
  rowMessages,
  translateCondition,
  translateLeftOperand,
  translateValidation,
} from "../intl";
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
  const intl = useIntl();
  // The row's own operand is missing from the add list once its maxOccurrences is reached; keep
  // it selectable so the select can show its label.
  const operands = useMemo(() => {
    // An empty row has no operand yet: nothing to keep, or the list would get a blank option.
    if (!item.value.value || leftOptions.some((option) => option.value === item.value.value)) {
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
  // Labels in the dashboard language (M11.3); the operands themselves keep their English labels.
  const shownOperands = useMemo(
    () =>
      operands.map((operand) => ({
        ...operand,
        label: translateLeftOperand(intl, operand.value, operand.label),
      })),
    [operands, intl],
  );
  const shownLabel = translateLeftOperand(intl, item.value.value, item.value.label);
  const conditionOptions = item.condition.options.map((option) => ({
    ...option,
    label: translateCondition(intl, option.label),
  }));
  const selectedCondition = item.condition.selected.conditionValue;
  const [query, setQuery] = useState("");
  const visibleOperands = useMemo(() => {
    const needle = query.trim().toLowerCase();

    // The input shows the selected label after a pick; that text must not hide the others.
    return needle === "" || needle === shownLabel.toLowerCase()
      ? shownOperands
      : shownOperands.filter((operand) => operand.label.toLowerCase().includes(needle));
  }, [shownOperands, query, shownLabel]);

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
        value={shownOperands.find((operand) => operand.value === item.value.value) ?? null}
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
        helperText={translateValidation(intl, error.left.text)}
      />

      <Select
        id={getFilterControlId("condition", index)}
        data-test-id={`condition-${index}`}
        value={
          selectedCondition
            ? (conditionOptions.find((option) => option.value === selectedCondition.value) ?? null)
            : null
        }
        options={conditionOptions}
        onChange={(value) => {
          // Back to the untranslated condition: its label is what the URL stores.
          const condition = item.condition.options.find((option) => option.value === value?.value);
          if (condition) {
            emitter.changeCondition(index, condition);
          }
        }}
        error={error.condition.show}
        helperText={translateValidation(intl, error.condition.text)}
      />

      <div className={styles.valueField}>
        <RightOperator
          selected={item.condition.selected}
          index={index}
          emitter={emitter}
          error={error.right.show}
          helperText={translateValidation(intl, error.right.text)}
        />
      </div>

      <Button
        marginLeft="auto"
        variant="tertiary"
        aria-label={intl.formatMessage(rowMessages.removeCondition)}
        data-test-id={`remove-row-${index}`}
        icon={<X size={iconSize.medium} strokeWidth={iconStrokeWidth} />}
        onClick={() => emitter.removeRow(index)}
      />
    </Box>
  );
};
