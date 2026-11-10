// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterElement/FilterElement.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One filter row: a left operand (the field), a condition and its value. Saleor's constraint
// system, attribute selection and loading state are dropped: they serve filters (channel,
// currency, attributes) we don't support yet.
import { STATIC_PRODUCT_OPTIONS } from "../constants";
import { UrlEntry, type UrlToken } from "../ValueProvider/UrlToken";
import { Condition } from "./Condition";
import { ConditionOptions } from "./ConditionOptions";

export class ExpressionValue {
  constructor(
    public value: string,
    public label: string,
    public type: string,
  ) {}

  public isEmpty() {
    return this.value.length === 0 || this.label.length === 0;
  }

  /** The label and type of the left operand named by `slug`, or the slug itself when unknown. */
  public static fromSlug(slug: string) {
    const option = STATIC_PRODUCT_OPTIONS.find((o) => o.slug === slug);

    if (!option) {
      return new ExpressionValue(slug, slug, slug);
    }

    return new ExpressionValue(option.slug, option.label, option.type);
  }
}

export class FilterElement {
  public constructor(
    public value: ExpressionValue,
    public condition: Condition,
  ) {}

  public isEmpty() {
    return this.value.isEmpty() || this.condition.isEmpty();
  }

  public asUrlEntry(): UrlEntry {
    return UrlEntry.forStatic(this.condition.selected, this.value.value);
  }

  public equals(element: FilterElement) {
    return this.value.value === element.value.value;
  }

  /** null when the token names an unknown field, condition or malformed value. */
  public static fromUrlToken(token: UrlToken): FilterElement | null {
    if (!token.isStatic() || !ConditionOptions.isStaticName(token.name)) {
      return null;
    }

    const condition = Condition.fromUrlToken(token);

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
}

/** A flat list of filter rows separated by literal `AND` strings, as Saleor keeps it. */
export type FilterContainer = Array<string | FilterElement>;
