// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/types.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel's row and event shapes. Saleor's attribute, constraint, bulkselect, metadata and
// focus/blur/scroll event payloads are dropped with those controls.
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
    | RightOperatorChangeData;
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
