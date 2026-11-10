// Adapted from saleor-dashboard: src/components/ConditionalFilter/controlsType.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The empty value each condition control starts with. Only the controls our product conditions
// use; Saleor's date, text and text.double defaults are dropped with the fields that used them.
import type { ConditionValue } from "./FilterElement/ConditionValue";

const CONTROL_DEFAULTS = {
  select: "",
  combobox: "",
  multiselect: [] as ConditionValue,
  number: "",
  "number.range": ["", ""] as [string, string],
  datetime: "",
  "datetime.range": ["", ""] as [string, string],
};

export const getDefaultByControlName = (name: string): ConditionValue =>
  CONTROL_DEFAULTS[name as keyof typeof CONTROL_DEFAULTS];
