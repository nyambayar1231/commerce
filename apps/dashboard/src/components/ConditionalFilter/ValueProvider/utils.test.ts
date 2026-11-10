// Ported from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/utils.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { describe, expect, it } from "vitest";

import { Condition } from "../FilterElement/Condition";
import { ConditionOptions } from "../FilterElement/ConditionOptions";
import { ConditionSelected } from "../FilterElement/ConditionSelected";
import { ExpressionValue, FilterElement } from "../FilterElement/FilterElement";
import { areFilterContainersEqual, getFilterContainerKey, hasUnsavedFilterChanges } from "./utils";

describe("ConditionalFilter / ValueProvider / utils", () => {
  const categoryFilter = new FilterElement(
    new ExpressionValue("category", "Category", "category"),
    new Condition(
      ConditionOptions.fromStaticElementName("category"),
      new ConditionSelected("cat-1", { type: "combobox", label: "is", value: "input-1" }, []),
    ),
  );

  it("treats identical filter containers as equal", () => {
    expect(areFilterContainersEqual([categoryFilter], [categoryFilter])).toBe(true);
  });

  it("treats empty filter containers as equal", () => {
    expect(areFilterContainersEqual([], [])).toBe(true);
  });

  it("detects a changed container", () => {
    expect(areFilterContainersEqual([categoryFilter], [])).toBe(false);
  });

  it("treats an in-place edit as unsaved against a committed snapshot", () => {
    const committedKey = getFilterContainerKey([categoryFilter]);

    categoryFilter.condition.selected.setValue("cat-2");

    expect(areFilterContainersEqual([categoryFilter], [categoryFilter])).toBe(true);
    expect(hasUnsavedFilterChanges([categoryFilter], committedKey)).toBe(true);
  });
});
