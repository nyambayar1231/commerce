// Ported from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/TokenArray/TokenArray.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Trimmed to our static product fields: the initial-state response lookups and attribute tokens of
// Saleor's tests are dropped, and values are checked directly instead of with snapshots.
import { describe, expect, it } from "vitest";

import { type FilterContainer, FilterElement } from "../../FilterElement/FilterElement";
import { parseFilterContainer, TokenArray } from ".";

const rows = (container: FilterContainer): FilterElement[] =>
  container.filter(FilterElement.isFilterElement);

describe("ConditionalFilter / ValueProvider / TokenArray", () => {
  it("parses an empty URL", () => {
    expect(new TokenArray("").asFilterContainer()).toEqual([]);
  });

  it("turns a product filter URL into rows and AND separators", () => {
    // Saleor's format: `s<condition>.<field>` with the value, arrays indexed per value.
    const container = new TokenArray(
      "0[s0.price]=123" +
        "&1=AND" +
        "&2[s2.category][0]=cat-1&2[s2.category][1]=cat-2" +
        "&3=AND" +
        "&4[s0.isPublished]=false" +
        "&5=AND" +
        "&6[s0.hasCategory]=true" +
        "&7=AND" +
        "&8[s4.updatedAt]=2024-01-01",
    ).asFilterContainer();

    const elements = rows(container);

    expect(elements.map((element) => element.value.value)).toEqual([
      "price",
      "category",
      "isPublished",
      "hasCategory",
      "updatedAt",
    ]);
    expect(elements[0]?.condition.selected.value).toBe("123");
    expect(elements[1]?.condition.selected.value).toEqual(["cat-1", "cat-2"]);
    expect(elements[2]?.condition.selected.value).toBe("false");
    expect(elements[3]?.condition.selected.conditionValue).toEqual({
      type: "select",
      label: "is",
      value: "input-1",
    });
    expect(container).toContain("AND");
  });

  it("uses Saleor's condition numbers from the URL", () => {
    const container = parseFilterContainer("0[s3.price][0]=100&0[s3.price][1]=200");

    expect(rows(container)[0]?.condition.selected.conditionValue?.label).toBe("between");
  });

  it("ignores fields, conditions and values we do not support", () => {
    const container = parseFilterContainer(
      "0[s0.channel]=channel-pln" +
        "&1[s0.isPublished]=maybe" +
        "&2[s0.price]=abc" +
        "&3[s4.updatedAt]=not-a-date" +
        "&4[s9.price]=1" +
        "&5[o2.bottle-size]=5l",
    );

    expect(rows(container)).toEqual([]);
  });

  it("keeps the valid rows of a mixed URL", () => {
    const container = parseFilterContainer(
      "0[s0.isPublished]=true&1[s0.price]=abc&2[s2.category][0]=cat-1",
    );

    expect(rows(container).map((element) => element.value.value)).toEqual([
      "isPublished",
      "category",
    ]);
  });
});
