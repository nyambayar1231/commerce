// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/operators.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Which right-hand control a condition's type selects. Only the controls our product fields use.
import type { ConditionSelected } from "../FilterElement/ConditionSelected";

export const isCombobox = (value: ConditionSelected) => value.conditionValue?.type === "combobox";

export const isMultiselect = (value: ConditionSelected) =>
  value.conditionValue?.type === "multiselect";

export const isSelect = (value: ConditionSelected) => value.conditionValue?.type === "select";

export const isNumberInput = (value: ConditionSelected) => value.conditionValue?.type === "number";

export const isNumberRange = (value: ConditionSelected) =>
  value.conditionValue?.type === "number.range";

export const isDateTime = (value: ConditionSelected) => value.conditionValue?.type === "datetime";

export const isDateTimeRange = (value: ConditionSelected) =>
  value.conditionValue?.type === "datetime.range";
