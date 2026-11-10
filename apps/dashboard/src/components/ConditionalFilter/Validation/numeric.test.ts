// Adapted from saleor-dashboard: src/components/ConditionalFilter/Validation/numeric.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { describe, expect, it } from "vitest";

import { Condition } from "../FilterElement/Condition";
import { ConditionOptions } from "../FilterElement/ConditionOptions";
import { ConditionSelected } from "../FilterElement/ConditionSelected";
import { ExpressionValue, FilterElement } from "../FilterElement/FilterElement";
import { validateFilterElementToBeNumeric } from "./numeric";

const priceElement = (value: string | [string, string]): FilterElement =>
  new FilterElement(
    new ExpressionValue("price", "Price", "price"),
    new Condition(
      ConditionOptions.fromStaticElementName("price"),
      new ConditionSelected(
        value,
        { type: "number.range", label: "between", value: "input-4" },
        [],
      ),
    ),
  );

describe("ConditionalFilter / validation / numeric", () => {
  it.each([
    ["12345678901234567890123456", { rightText: "The value is too long.", row: 0 }],
    ["123", false],
    [["123", "321"], false],
    [["100", "1"], { rightText: "The value must be higher", row: 0 }],
    [["1", "12345678901234567890123456"], { rightText: "The value is too long.", row: 0 }],
  ] as Array<[string | [string, string], unknown]>)("should validate %p", (value, expected) => {
    expect(validateFilterElementToBeNumeric(priceElement(value), 0)).toEqual(expected);
  });
});
