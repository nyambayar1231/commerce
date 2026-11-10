// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/RightOperator.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The right-hand control of a condition. Only the controls our product fields use: number,
// number.range, datetime, datetime.range, select (Yes/No), and the static combobox/multiselect
// used by category rows carried over from the URL. Saleor's API-backed async options, attributes,
// bulk select, metadata and reference/swatch pickers are dropped.
import { Combobox, Input, Multiselect, RangeInput, Select } from "@saleor/macaw-ui";

import type { ConditionSelected } from "../FilterElement/ConditionSelected";
import {
  type ConditionValue,
  type ItemOption,
  isItemOption,
  isItemOptionArray,
  isTuple,
} from "../FilterElement/ConditionValue";
import type { FilterEventEmitter } from "./EventEmitter";
import { getFilterControlId } from "./filterControlId";
import {
  isCombobox,
  isDateTime,
  isDateTimeRange,
  isMultiselect,
  isNumberInput,
  isNumberRange,
  isSelect,
} from "./operators";
import { RangeInputWrapper } from "./RangeInputWrapper";

interface RightOperatorProps {
  index: number;
  selected: ConditionSelected;
  emitter: FilterEventEmitter;
  error: boolean;
  helperText: string;
}

const BOOLEAN_OPTIONS: ItemOption[] = [
  { label: "Yes", value: "true", slug: "true" },
  { label: "No", value: "false", slug: "false" },
];

const optionFromString = (value: string): ItemOption => ({
  label: value,
  value,
  slug: value,
});

/** The static options a category row's URL value already names (labels wait for M2.3.3b). */
const optionsFromValue = (value: ConditionValue): ItemOption[] => {
  if (isItemOptionArray(value)) {
    return value;
  }

  if (isItemOption(value)) {
    return [value];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.filter((entry) => entry.length > 0).map(optionFromString);
};

const selectedOption = (value: ConditionValue): ItemOption | null => {
  if (isItemOption(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  return BOOLEAN_OPTIONS.find((option) => option.value === value) ?? null;
};

const textValue = (value: ConditionValue): string => {
  if (isItemOption(value)) {
    return value.value;
  }

  return typeof value === "string" ? value : "";
};

const rangeValue = (value: ConditionValue): [string, string] => (isTuple(value) ? value : ["", ""]);

export const RightOperator = ({
  index,
  selected,
  emitter,
  error,
  helperText,
}: RightOperatorProps) => {
  if (isNumberInput(selected)) {
    return (
      <Input
        data-test-id={`right-${index}`}
        type="number"
        value={textValue(selected.value)}
        onChange={(event) => emitter.changeRightOperator(index, event.target.value)}
        error={error}
        helperText={helperText}
        width="100%"
      />
    );
  }

  if (isNumberRange(selected)) {
    return (
      <RangeInputWrapper>
        <RangeInput
          data-test-id={`right-${index}`}
          value={rangeValue(selected.value)}
          onChange={(value) => emitter.changeRightOperator(index, value)}
          type="number"
          error={error}
          helperText={helperText}
          width="100%"
        />
      </RangeInputWrapper>
    );
  }

  if (isDateTime(selected)) {
    return (
      <Input
        data-test-id={`right-${index}`}
        type="datetime-local"
        value={textValue(selected.value)}
        onChange={(event) => emitter.changeRightOperator(index, event.target.value)}
        error={error}
        helperText={helperText}
        width="100%"
      />
    );
  }

  if (isDateTimeRange(selected)) {
    return (
      <RangeInputWrapper inline compact="datetime">
        <RangeInput
          data-test-id={`right-${index}`}
          value={rangeValue(selected.value)}
          onChange={(value) => emitter.changeRightOperator(index, value)}
          type="datetime-local"
          error={error}
          helperText={helperText}
        />
      </RangeInputWrapper>
    );
  }

  if (isSelect(selected)) {
    return (
      <Select
        id={getFilterControlId("right", index)}
        data-test-id={`right-${index}`}
        value={selectedOption(selected.value)}
        options={BOOLEAN_OPTIONS}
        onChange={(value) => {
          if (value) emitter.changeRightOperator(index, value);
        }}
        error={error}
        helperText={helperText}
        width="100%"
      />
    );
  }

  if (isCombobox(selected)) {
    const options = optionsFromValue(selected.value);

    return (
      <Combobox
        id={getFilterControlId("right", index)}
        data-test-id={`right-${index}`}
        value={options[0] ?? null}
        options={options}
        onChange={(value) => {
          if (value) emitter.changeRightOperator(index, value);
        }}
        error={error}
        helperText={helperText}
        width="100%"
      />
    );
  }

  if (isMultiselect(selected)) {
    const options = optionsFromValue(selected.value);

    return (
      <Multiselect
        id={getFilterControlId("right", index)}
        data-test-id={`right-${index}`}
        value={options}
        options={options}
        onChange={(value) => emitter.changeRightOperator(index, value)}
        error={error}
        helperText={helperText}
        width="100%"
      />
    );
  }

  return (
    <Input
      disabled
      data-test-id={`right-${index}`}
      value={textValue(selected.value)}
      width="100%"
    />
  );
};
