import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { ProductVariantRow } from "./datagrid";
import { createGetCellContent, parseWarehousesColumns, variantsStaticColumns } from "./datagrid";

const intl = createIntl({ locale: "en" });

const variant = (overrides: Partial<ProductVariantRow> = {}): ProductVariantRow => ({
  __typename: "ProductVariant",
  id: "v1",
  name: "Size 39",
  sku: "BT-39",
  price: { __typename: "Money", amount: 15000, currency: "MNT" },
  stocks: [],
  ...overrides,
});

describe("variants datagrid", () => {
  it("has Saleor's three columns in order, with the briefed widths", () => {
    expect(
      variantsStaticColumns(intl).map((column) => [column.id, column.title, column.width]),
    ).toEqual([
      ["name", "Variant name", 200],
      ["sku", "SKU", 200],
      ["price", "Price", 150],
    ]);
  });

  it("renders the name, SKU and formatted price as read-only text", () => {
    const columns = variantsStaticColumns(intl);
    const get = createGetCellContent([variant()], columns, intl);

    expect(get([0, 0])).toMatchObject({
      kind: GridCellKind.Text,
      data: "Size 39",
      readonly: true,
      cursor: "pointer",
    });
    expect(get([1, 0])).toMatchObject({ data: "BT-39" });
    expect(get([2, 0])).toMatchObject({
      data: intl.formatNumber(15000, {
        style: "currency",
        currency: "MNT",
        maximumFractionDigits: 0,
      }),
    });
  });

  it("shows an empty cell for an empty name or SKU", () => {
    const columns = variantsStaticColumns(intl);
    const get = createGetCellContent([variant({ name: "", sku: null })], columns, intl);

    expect(get([0, 0])).toMatchObject({ data: "" });
    expect(get([1, 0])).toMatchObject({ data: "" });
  });

  it("formats the price in its own currency", () => {
    const columns = variantsStaticColumns(intl);
    const get = createGetCellContent(
      [variant({ price: { __typename: "Money", amount: 1234, currency: "USD" } })],
      columns,
      intl,
    );

    expect(get([2, 0])).toMatchObject({
      data: intl.formatNumber(1234, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    });
  });

  it("returns an empty, non-clickable cell outside the rows", () => {
    const columns = variantsStaticColumns(intl);
    const get = createGetCellContent([variant()], columns, intl);

    expect(get([0, 5])).toMatchObject({ data: "", cursor: "default" });
  });
});

describe("variants datagrid warehouse columns", () => {
  const warehouses = [
    { id: "w1", name: "Main warehouse" },
    { id: "w2", name: "Returns" },
  ];

  it("adds one column per warehouse after the static ones, titled with its name", () => {
    expect(parseWarehousesColumns(warehouses)).toEqual([
      { id: "warehouse:w1", title: "Main warehouse", width: 150 },
      { id: "warehouse:w2", title: "Returns", width: 150 },
    ]);
  });

  it("shows a variant's quantity in its warehouse column", () => {
    const columns = [...variantsStaticColumns(intl), ...parseWarehousesColumns(warehouses)];
    const get = createGetCellContent(
      [
        variant({
          stocks: [
            {
              __typename: "Stock",
              id: "s1",
              quantity: 7,
              warehouse: { __typename: "Warehouse", id: "w1" },
            },
          ],
        }),
      ],
      columns,
      intl,
    );

    expect(get([3, 0])).toMatchObject({ kind: GridCellKind.Text, data: "7", readonly: true });
  });

  it("shows an empty cell when the variant has no stock row in the warehouse", () => {
    const columns = [...variantsStaticColumns(intl), ...parseWarehousesColumns(warehouses)];
    const get = createGetCellContent([variant()], columns, intl);

    expect(get([3, 0])).toMatchObject({ data: "" });
    expect(get([4, 0])).toMatchObject({ data: "" });
  });
});
