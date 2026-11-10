// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/types.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel's row and event shapes. The right-hand focus/input/scroll payloads drive the category
// picker; Saleor's attribute, constraint, bulkselect, metadata and blur payloads are dropped.
import type { ConditionItem } from "../FilterElement/ConditionOptions";
import type { ConditionValue } from "../FilterElement/ConditionValue";
import type { FilterElement } from "../FilterElement/FilterElement";

export type Row = FilterElement;

export interface LeftOperatorOption {
  label: string;
  value: string;
  type: string;
  slug: string;
}

export interface FilterError {
  row: number;
  leftText?: string;
  conditionText?: string;
  rightText?: string;
}

export interface FilterEvent extends Event {
  detail?:
    | RowAddData
    | RowRemoveData
    | LeftOperatorChangeData
    | ConditionChangeData
    | RightOperatorChangeData
    | RightOperatorFocusData
    | RightOperatorInputValueChangeData
    | RightOperatorScrollEndData;
}

export interface RowAddData {
  type: "row.add";
}

export interface RowRemoveData {
  type: "row.remove";
  path: `${number}`;
  index: number;
}

export interface LeftOperatorChangeData {
  type: "leftOperator.onChange";
  path: `${number}`;
  index: number;
  value: LeftOperatorOption;
}

export interface ConditionChangeData {
  type: "condition.onChange";
  path: `${number}.condition.selected`;
  index: number;
  value: ConditionItem;
}

export interface RightOperatorChangeData {
  type: "rightOperator.onChange";
  path: `${number}.condition.selected.value`;
  index: number;
  value: ConditionValue;
}

export interface RightOperatorFocusData {
  type: "rightOperator.onFocus";
  path: `${number}.condition.selected.value`;
  index: number;
}

export interface RightOperatorInputValueChangeData {
  type: "rightOperator.onInputValueChange";
  path: `${number}.condition.selected.value`;
  index: number;
  value: string;
}

export interface RightOperatorScrollEndData {
  type: "rightOperator.onScrollEnd";
  path: `${number}.condition.selected.value`;
  index: number;
}
