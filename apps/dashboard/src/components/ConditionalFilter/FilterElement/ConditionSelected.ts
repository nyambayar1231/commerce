// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterElement/ConditionSelected.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The chosen condition and its value. `options` and `loading` feed the async pickers: a category
// row keeps the options loaded for it, and shows a spinner while a page is in flight.
import { getDefaultByControlName } from "../controlsType";
import type { ConditionItem } from "./ConditionOptions";
import { type ConditionValue, isItemOption, isItemOptionArray, isTuple } from "./ConditionValue";

const optionsFromSelectedValue = (value: ConditionValue): ConditionValue[] => {
  if (isItemOption(value)) {
    return [value];
  }

  if (isItemOptionArray(value)) {
    return value;
  }

  return [];
};

export class ConditionSelected {
  public constructor(
    public value: ConditionValue,
    public conditionValue: ConditionItem | null,
    public options: ConditionValue[],
    public loading = false,
  ) {}

  public isEmpty() {
    return (
      this.value === "" ||
      (isItemOptionArray(this.value) && this.value.length === 0) ||
      (isTuple(this.value) && this.value.every((el) => el === ""))
    );
  }

  public static empty() {
    return new ConditionSelected("", null, []);
  }

  public static fromConditionItem(conditionItem: ConditionItem) {
    return new ConditionSelected(getDefaultByControlName(conditionItem.type), conditionItem, []);
  }

  public static fromConditionItemAndValue(conditionItem: ConditionItem, value: ConditionValue) {
    return new ConditionSelected(value, conditionItem, optionsFromSelectedValue(value));
  }

  public enableLoading() {
    this.loading = true;
  }

  public disableLoading() {
    this.loading = false;
  }

  public isLoading() {
    return this.loading;
  }

  public setValue(value: ConditionValue) {
    this.value = value;
  }

  public setOptions(options: ConditionValue[]) {
    this.options = options;
  }

  public clone(): ConditionSelected {
    return new ConditionSelected(
      cloneConditionValue(this.value),
      this.conditionValue,
      this.options.map(cloneConditionValue),
      this.loading,
    );
  }
}

const cloneConditionValue = (value: ConditionValue): ConditionValue => {
  if (isItemOptionArray(value)) {
    return value.map((item) => ({ ...item }));
  }

  if (isItemOption(value)) {
    return { ...value };
  }

  if (isTuple(value)) {
    return [value[0], value[1]];
  }

  return value;
};
