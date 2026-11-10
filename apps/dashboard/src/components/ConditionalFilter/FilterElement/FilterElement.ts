// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterElement/FilterElement.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One filter row: a left operand (the field), a condition and its value. Saleor's constraint
// system, attribute selection and attribute loading state are dropped: they serve filters we
// don't support yet. The right-hand option/loading updates are kept for the category picker.

import type { InitialProductStateResponse } from "../API/initialState/product/InitialProductStateResponse";
import { STATIC_PRODUCT_OPTIONS } from "../constants";
import type { LeftOperand } from "../LeftOperandsProvider";
import { UrlEntry, type UrlToken } from "../ValueProvider/UrlToken";
import { Condition } from "./Condition";
import { type ConditionItem, ConditionOptions, type StaticElementName } from "./ConditionOptions";
import { ConditionSelected } from "./ConditionSelected";
import type { ConditionValue, ItemOption } from "./ConditionValue";

export class ExpressionValue {
  constructor(
    public value: string,
    public label: string,
    public type: string,
  ) {}

  public isEmpty() {
    return this.value.length === 0 || this.label.length === 0;
  }

  public clone(): ExpressionValue {
    return new ExpressionValue(this.value, this.label, this.type);
  }

  /** The label and type of the left operand named by `slug`, or the slug itself when unknown. */
  public static fromSlug(slug: string) {
    const option = STATIC_PRODUCT_OPTIONS.find((o) => o.slug === slug);

    if (!option) {
      return new ExpressionValue(slug, slug, slug);
    }

    return new ExpressionValue(option.slug, option.label, option.type);
  }

  public static fromLeftOperand(leftOperand: LeftOperand) {
    return new ExpressionValue(leftOperand.slug, leftOperand.label, leftOperand.type);
  }

  public static emptyStatic() {
    return new ExpressionValue("", "", "s");
  }
}

export class FilterElement {
  public constructor(
    public value: ExpressionValue,
    public condition: Condition,
  ) {}

  public updateLeftOperator(leftOperand: LeftOperand) {
    this.value = ExpressionValue.fromLeftOperand(leftOperand);
    this.condition = Condition.emptyFromSlug(leftOperand.value as StaticElementName);
  }

  public updateCondition(conditionValue: ConditionItem) {
    this.condition.selected = ConditionSelected.fromConditionItem(conditionValue);
  }

  public updateRightOperator(value: ConditionValue) {
    this.condition.selected.setValue(value);
  }

  public updateRightOptions(options: ItemOption[]) {
    this.condition.selected.setOptions(options);
  }

  public updateRightLoadingState(loading: boolean) {
    if (loading) {
      this.condition.selected.enableLoading();

      return;
    }

    this.condition.selected.disableLoading();
  }

  public isEmpty() {
    return this.value.isEmpty() || this.condition.isEmpty();
  }

  public isStatic() {
    return ConditionOptions.isStaticName(this.value.type);
  }

  public asUrlEntry(): UrlEntry {
    return UrlEntry.forStatic(this.condition.selected, this.value.value);
  }

  public equals(element: FilterElement) {
    return this.value.value === element.value.value;
  }

  public clone(): FilterElement {
    return new FilterElement(this.value.clone(), this.condition.clone());
  }

  /** null when the token names an unknown field, condition or malformed value. */
  public static fromUrlToken(
    token: UrlToken,
    response?: InitialProductStateResponse,
  ): FilterElement | null {
    if (!token.isStatic() || !ConditionOptions.isStaticName(token.name)) {
      return null;
    }

    const condition = Condition.fromUrlToken(token, response);

    return condition === null
      ? null
      : new FilterElement(ExpressionValue.fromSlug(token.name), condition);
  }

  public static isFilterElement(element: unknown): element is FilterElement {
    return (
      typeof element === "object" &&
      !Array.isArray(element) &&
      element !== null &&
      "value" in element
    );
  }

  public static createEmpty() {
    return new FilterElement(ExpressionValue.emptyStatic(), Condition.createEmpty());
  }

  public static createStaticBySlug(slug: StaticElementName) {
    return new FilterElement(ExpressionValue.fromSlug(slug), Condition.emptyFromSlug(slug));
  }
}

/** A flat list of filter rows separated by literal `AND` strings, as Saleor keeps it. */
export type FilterContainer = Array<string | FilterElement>;

export const hasEmptyRows = (container: FilterContainer): boolean =>
  container.filter(FilterElement.isFilterElement).some((element) => element.isEmpty());

/** A deep copy so in-place edits in the panel never touch the provider's rows. */
export const cloneFilterContainer = (container: FilterContainer): FilterContainer =>
  container.map((item) => (typeof item === "string" ? item : item.clone()));
