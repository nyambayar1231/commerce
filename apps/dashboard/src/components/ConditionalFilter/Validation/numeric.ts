// Adapted from saleor-dashboard: src/components/ConditionalFilter/Validation/numeric.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor checks both ends of a range but (a bug) measures the lower value twice; we measure each
// end. The messages are Saleor's.
import type { FilterElement } from "../FilterElement/FilterElement";

const isTooLong = (value: string, row: number) => {
  if (value.length > 25) {
    return {
      row,
      rightText: "The value is too long.",
    };
  }

  return false;
};

export const validateFilterElementToBeNumeric = (element: FilterElement, row: number) => {
  const { value } = element.condition.selected;

  if (Array.isArray(value) && value.length === 2) {
    const [first, second] = value as [string, string];
    const errorsFirst = isTooLong(first, row);
    const errorsSecond = isTooLong(second, row);

    if (errorsFirst) return errorsFirst;

    if (errorsSecond) return errorsSecond;

    const lower = Number.parseFloat(first);
    const upper = Number.parseFloat(second);

    if (lower > upper) {
      return {
        row,
        rightText: "The value must be higher",
      };
    }
  }

  if (typeof value === "string") {
    return isTooLong(value, row);
  }

  return false;
};
