// Ported from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/UrlToken.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Trimmed to static product fields: Saleor's attribute and reference token cases are dropped with
// the token types we don't support.
import { describe, expect, it } from "vitest";

import { ConditionSelected } from "../FilterElement/ConditionSelected";
import { UrlEntry, UrlToken } from "./UrlToken";

describe("UrlEntry", () => {
  it("creates an instance with a single value", () => {
    expect(new UrlEntry("key", "value")).toEqual({ key: "value" });
  });

  it("creates an instance with an array value", () => {
    expect(new UrlEntry("key", ["value1", "value2"])).toEqual({ key: ["value1", "value2"] });
  });

  it("creates an entry for a static condition", () => {
    const condition = new ConditionSelected(
      "false",
      { type: "select", label: "is", value: "input-1" },
      [],
    );

    const entry = UrlEntry.forStatic(condition, "isPublished");

    expect(entry).toEqual({ "s0.isPublished": "false" });
    expect(entry.getInfo()).toEqual({
      key: "s0.isPublished",
      value: "false",
      entryName: "isPublished",
      type: "s",
      conditionKind: "is",
    });
  });

  it("numbers the condition from Saleor's conditions list", () => {
    const condition = new ConditionSelected(
      ["cat-1", "cat-2"],
      { type: "multiselect", label: "in", value: "input-2" },
      [],
    );

    expect(UrlEntry.forStatic(condition, "category")).toEqual({
      "s2.category": ["cat-1", "cat-2"],
    });
  });
});

describe("UrlToken", () => {
  it("reads the field, type and condition from the entry key", () => {
    const token = UrlToken.fromUrlEntry(new UrlEntry("s4.updatedAt", "2024-01-01"));

    expect(token).toMatchObject({
      name: "updatedAt",
      value: "2024-01-01",
      type: "s",
      conditionKind: "lower",
    });
  });

  it("rejects a key without a field or with an unknown condition", () => {
    expect(UrlToken.fromUrlEntry(new UrlEntry("s0", "x"))).toBeNull();
    expect(UrlToken.fromUrlEntry(new UrlEntry("s9.price", "x"))).toBeNull();
  });

  it("does not treat an attribute token as static", () => {
    const token = UrlToken.fromUrlEntry(new UrlEntry("o2.bottle-size", "5l"));

    expect(token?.isStatic()).toBe(false);
  });
});
