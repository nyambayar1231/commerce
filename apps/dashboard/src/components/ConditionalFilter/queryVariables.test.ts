// Ported from saleor-dashboard: src/components/ConditionalFilter/queryVariables.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Trimmed to the product fields we keep; every expected shape follows Saleor's builders
// (`{ eq }`, `{ oneOf }`, `{ range }`) and our API's ProductWhereInput.
import { describe, expect, it } from "vitest";

import { Condition } from "./FilterElement/Condition";
import {
  type ConditionItem,
  ConditionOptions,
  type StaticElementName,
} from "./FilterElement/ConditionOptions";
import { ConditionSelected } from "./FilterElement/ConditionSelected";
import type { ConditionValue } from "./FilterElement/ConditionValue";
import { ExpressionValue, FilterElement } from "./FilterElement/FilterElement";
import { createOrderQueryVariables, createProductQueryVariables } from "./queryVariables";
import { parseFilterContainer } from "./ValueProvider/TokenArray";

const conditionItem = (field: StaticElementName, label: string): ConditionItem => {
  const item = ConditionOptions.fromStaticElementName(field).findByLabel(label);

  if (!item) {
    throw new Error(`No "${label}" condition for ${field}`);
  }

  return item;
};

const element = (field: StaticElementName, label: string, value: ConditionValue): FilterElement =>
  new FilterElement(
    ExpressionValue.fromSlug(field),
    new Condition(
      ConditionOptions.fromStaticElementName(field),
      new ConditionSelected(value, conditionItem(field, label), []),
    ),
  );

const whereOfUrl = (search: string) => createProductQueryVariables(parseFilterContainer(search));

describe("ConditionalFilter / queryVariables / createProductQueryVariables", () => {
  it("returns no where for empty filters", () => {
    expect(createProductQueryVariables([])).toBeNull();
    expect(whereOfUrl("")).toBeNull();
  });

  it("keeps a single filter at the top level", () => {
    expect(whereOfUrl("0[s0.isPublished]=false")).toEqual({ isPublished: false });
    // A boolean only offers "is" (`s0`); another condition is ignored, as in Saleor.
    expect(whereOfUrl("0[s2.isPublished]=false")).toBeNull();
    expect(whereOfUrl("0[s0.hasCategory]=true")).toEqual({ hasCategory: true });
  });

  it("maps category is/in to eq/oneOf", () => {
    expect(whereOfUrl("0[s0.category]=cat-1")).toEqual({ category: { eq: "cat-1" } });
    expect(whereOfUrl("0[s2.category][0]=cat-1&0[s2.category][1]=cat-2")).toEqual({
      category: { oneOf: ["cat-1", "cat-2"] },
    });
  });

  it("maps every price condition to our DecimalFilterInput", () => {
    expect(whereOfUrl("0[s0.price]=123")).toEqual({ price: { eq: "123" } });
    expect(whereOfUrl("0[s4.price]=100")).toEqual({ price: { range: { lte: "100" } } });
    expect(whereOfUrl("0[s5.price]=100")).toEqual({ price: { range: { gte: "100" } } });
    expect(whereOfUrl("0[s3.price][0]=100&0[s3.price][1]=200")).toEqual({
      price: { range: { gte: "100", lte: "200" } },
    });
  });

  it("maps updatedAt to a DateTime range", () => {
    expect(whereOfUrl("0[s4.updatedAt]=2024-01-01")).toEqual({
      updatedAt: { range: { lte: "2024-01-01" } },
    });
    expect(whereOfUrl("0[s5.updatedAt]=2024-01-01")).toEqual({
      updatedAt: { range: { gte: "2024-01-01" } },
    });
    expect(whereOfUrl("0[s3.updatedAt][0]=2024-01-01&0[s3.updatedAt][1]=2024-12-31")).toEqual({
      updatedAt: { range: { gte: "2024-01-01", lte: "2024-12-31" } },
    });
  });

  it("nests several filters under AND", () => {
    expect(
      whereOfUrl("0[s0.isPublished]=false&1=AND&2[s2.category][0]=cat-1&3=AND&4[s4.price]=100"),
    ).toEqual({
      AND: [
        { isPublished: false },
        { category: { oneOf: ["cat-1"] } },
        { price: { range: { lte: "100" } } },
      ],
    });
  });

  it("builds the same where from a filter element built in code", () => {
    expect(createProductQueryVariables([element("price", "between", ["100", "200"])])).toEqual({
      price: { range: { gte: "100", lte: "200" } },
    });
  });

  it("skips empty rows", () => {
    expect(createProductQueryVariables([element("price", "is", "")])).toBeNull();
  });
});

describe("createOrderQueryVariables", () => {
  const orderWhereOfUrl = (search: string) =>
    createOrderQueryVariables(parseFilterContainer(search));

  it("maps `is` to eq and `in` to oneOf, from the URL", () => {
    expect(orderWhereOfUrl("0[s0.status]=UNFULFILLED")).toEqual({
      status: { eq: "UNFULFILLED" },
    });
    expect(orderWhereOfUrl("0[s2.status][0]=FULFILLED&0[s2.status][1]=CANCELED")).toEqual({
      status: { oneOf: ["FULFILLED", "CANCELED"] },
    });
  });

  it("reads picked options", () => {
    const option = { label: "Unfulfilled", value: "UNFULFILLED", slug: "UNFULFILLED" };

    expect(createOrderQueryVariables([element("status", "is", option)])).toEqual({
      status: { eq: "UNFULFILLED" },
    });
    expect(createOrderQueryVariables([element("status", "in", [option])])).toEqual({
      status: { oneOf: ["UNFULFILLED"] },
    });
  });

  it("ignores unknown statuses, other fields and empty rows", () => {
    expect(orderWhereOfUrl("0[s0.status]=DRAFT")).toBeNull();
    expect(orderWhereOfUrl("0[s0.isPublished]=true")).toBeNull();
    expect(createOrderQueryVariables([element("status", "in", [])])).toBeNull();
  });
});
