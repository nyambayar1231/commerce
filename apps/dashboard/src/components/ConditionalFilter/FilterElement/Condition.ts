// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterElement/Condition.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A left operand's condition options plus the selected one. Unlike Saleor we have no initial
// option response to look values up in: the value comes straight from the URL and is validated
// per field here, so an invalid entry becomes an ignorable element instead of crashing the page.
import type { UrlToken } from "../ValueProvider/UrlToken";
import { type ConditionItem, ConditionOptions, type StaticElementName } from "./ConditionOptions";
import { ConditionSelected } from "./ConditionSelected";
import type { ConditionValue } from "./ConditionValue";

const DECIMAL = /^-?\d+(\.\d+)?$/;

const isDecimal = (value: string): boolean => DECIMAL.test(value);
const isBoolean = (value: string): boolean => value === "true" || value === "false";
const isDate = (value: string): boolean => !Number.isNaN(new Date(value).getTime());

const toValues = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

/** A single value for `is`/`lower`/`greater`, exactly two for `between`. */
const single = (value: string | string[], valid: (value: string) => boolean): string | null => {
  const values = toValues(value);

  return values.length === 1 && valid(values[0] as string) ? (values[0] as string) : null;
};

const pair = (
  value: string | string[],
  valid: (value: string) => boolean,
): [string, string] | null => {
  const values = toValues(value);

  return values.length === 2 && values.every(valid)
    ? [values[0] as string, values[1] as string]
    : null;
};

/** Reads the token value for the field and condition, or null when the URL entry is invalid. */
function valueFromToken(
  name: StaticElementName,
  conditionLabel: string,
  tokenValue: string | string[],
): ConditionValue | null {
  switch (name) {
    case "category": {
      if (conditionLabel === "is") {
        return single(tokenValue, (value) => value.length > 0);
      }

      const values = toValues(tokenValue).filter((value) => value.length > 0);

      return values.length === 0 ? null : values;
    }
    case "isPublished":
    case "hasCategory":
      return single(tokenValue, isBoolean);
    case "price":
      return conditionLabel === "between"
        ? pair(tokenValue, isDecimal)
        : single(tokenValue, isDecimal);
    case "updatedAt":
      return conditionLabel === "between" ? pair(tokenValue, isDate) : single(tokenValue, isDate);
    default:
      return null;
  }
}

export class Condition {
  public constructor(
    public options: ConditionOptions,
    public selected: ConditionSelected,
  ) {}

  public isEmpty() {
    return this.options.isEmpty() || this.selected.isEmpty();
  }

  public clone(): Condition {
    return new Condition(this.options, this.selected.clone());
  }

  public static createEmpty() {
    return new Condition(ConditionOptions.empty(), ConditionSelected.empty());
  }

  public static emptyFromSlug(slug: StaticElementName) {
    const options = ConditionOptions.fromStaticElementName(slug);

    return new Condition(options, ConditionSelected.fromConditionItem(options.first()));
  }

  /** null when the token names no condition this field supports or its value is malformed. */
  public static fromUrlToken(token: UrlToken): Condition | null {
    if (!ConditionOptions.isStaticName(token.name)) {
      return null;
    }

    const options = ConditionOptions.fromStaticElementName(token.name);
    // As Saleor: the token's condition must be one this field offers (a boolean only has "is",
    // `s0`), otherwise the entry is ignored.
    const selectedOption = options.findByLabel(token.conditionKind);

    if (!selectedOption) {
      return null;
    }

    const value = valueFromToken(token.name, selectedOption.label, token.value);

    return value === null
      ? null
      : new Condition(options, ConditionSelected.fromConditionItemAndValue(selectedOption, value));
  }
}
