// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/RightOperator.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The right-hand control of a condition. Only the controls our product fields use: number,
// number.range, datetime, datetime.range, select (Yes/No), and the async combobox/multiselect
// that pick categories from the API. Saleor's attributes, bulk select, metadata and
// reference/swatch pickers are dropped.
import { DynamicCombobox, DynamicMultiselect, Input, RangeInput, Select } from "@saleor/macaw-ui";

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
import {
  includeSelectedComboboxOptions,
  isSelectedComboboxLabel,
  isSelectedMultiselectLabel,
  resolveComboboxValue,
} from "./resolveAsyncComboboxState";

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

/** The options a value already names: loaded options, or raw URL strings until they are looked up. */
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
    const selectedOptions = selected.options.filter(isItemOption);
    const selectedValues = optionsFromValue(selected.value);
    const options = includeSelectedComboboxOptions(selectedOptions, selectedValues);
    const value = resolveComboboxValue(options, selectedValues[0] ?? null);

    return (
      <DynamicCombobox
        id={getFilterControlId("right", index)}
        data-test-id={`right-${index}`}
        value={value}
        options={options}
        loading={selected.loading}
        onChange={(nextValue) => {
          if (!nextValue) return;

          emitter.changeRightOperator(index, nextValue);
        }}
        onInputValueChange={(inputValue) => {
          if (isSelectedComboboxLabel(selected.value, inputValue)) return;

          emitter.inputChangeRightOperator(index, inputValue);
        }}
        onScrollEnd={() => emitter.scrollEndRightOperator(index)}
        onFocus={() => emitter.focusRightOperator(index)}
        error={error}
        helperText={helperText}
        width="100%"
      />
    );
  }

  if (isMultiselect(selected)) {
    const selectedOptions = selected.options.filter(isItemOption);
    const selectedValues = optionsFromValue(selected.value);
    const options = includeSelectedComboboxOptions(selectedOptions, selectedValues);

    return (
      <DynamicMultiselect
        id={getFilterControlId("right", index)}
        data-test-id={`right-${index}`}
        value={selectedValues}
        options={options}
        loading={selected.loading}
        onChange={(value) => emitter.changeRightOperator(index, value)}
        onInputValueChange={(inputValue) => {
          if (isSelectedMultiselectLabel(selected.value, inputValue)) return;

          emitter.inputChangeRightOperator(index, inputValue);
        }}
        onScrollEnd={() => emitter.scrollEndRightOperator(index)}
        onFocus={() => emitter.focusRightOperator(index)}
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
