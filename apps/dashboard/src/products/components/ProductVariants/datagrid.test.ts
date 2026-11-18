import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import { numberCellEmptyValue } from "../../../components/Datagrid/customCells/NumberCell";
import type { DatagridChange } from "../../../components/Datagrid/hooks/useDatagridChange";
import {
  createGetCellContent,
  getInvalidVariantGridErrors,
  getVariantFieldErrors,
  getVariantGridUpdates,
  getVariantStockErrors,
  hasVariantGridError,
  type ProductVariantRow,
  parseWarehousesColumns,
  variantsStaticColumns,
} from "./datagrid";

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

const warehouseColumns = parseWarehousesColumns([
  { id: "w1", name: "Main warehouse" },
  { id: "w2", name: "Returns" },
]);

const cellOpts = (changes: DatagridChange[] = []) => ({
  changes: { current: changes },
  getChangeIndex: (column: string, row: number) =>
    changes.findIndex((change) => change.column === column && change.row === row),
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

  it("renders the name, SKU and price as editable cells", () => {
    const columns = [...variantsStaticColumns(intl), ...warehouseColumns];
    const get = createGetCellContent([variant()], columns);
    const opts = cellOpts();

    expect(get([0, 0], opts)).toMatchObject({
      kind: GridCellKind.Text,
      data: "Size 39",
      readonly: false,
      allowOverlay: true,
    });
    expect(get([1, 0], opts)).toMatchObject({ data: "BT-39", readonly: false });
    expect(get([2, 0], opts)).toMatchObject({
      kind: GridCellKind.Custom,
      readonly: false,
      allowOverlay: true,
      data: { kind: "number-cell", value: 15000 },
    });
  });

  it("shows an empty cell for an empty name or SKU", () => {
    const columns = variantsStaticColumns(intl);
    const get = createGetCellContent([variant({ name: "", sku: null })], columns);
    const opts = cellOpts();

    expect(get([0, 0], opts)).toMatchObject({ data: "" });
    expect(get([1, 0], opts)).toMatchObject({ data: "" });
  });

  it("shows a cell's pending edit instead of the saved value", () => {
    const changes: DatagridChange[] = [
      { row: 0, column: "name", data: "Size 40" },
      { row: 0, column: "price", data: { kind: "number-cell", value: 21000 } },
      { row: 0, column: "warehouse:w1", data: { kind: "number-cell", value: 7 } },
    ];
    const columns = [...variantsStaticColumns(intl), ...warehouseColumns];
    const get = createGetCellContent([variant()], columns);
    const opts = cellOpts(changes);

    expect(get([0, 0], opts)).toMatchObject({ data: "Size 40" });
    expect(get([2, 0], opts)).toMatchObject({ data: { value: 21000 } });
    expect(get([3, 0], opts)).toMatchObject({ data: { value: 7 } });
  });

  it("returns an empty, non-editable cell outside the rows", () => {
    const columns = variantsStaticColumns(intl);
    const get = createGetCellContent([variant()], columns);
    const opts = cellOpts();

    expect(get([0, 5], opts)).toMatchObject({ data: "", readonly: true, cursor: "default" });
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

  it("shows a variant's quantity in its warehouse column as an editable number", () => {
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
    );
    const opts = cellOpts();

    expect(get([3, 0], opts)).toMatchObject({
      kind: GridCellKind.Custom,
      readonly: false,
      data: { kind: "number-cell", value: 7 },
    });
  });

  it("shows an empty number cell when the variant has no stock row in the warehouse", () => {
    const columns = [...variantsStaticColumns(intl), ...parseWarehousesColumns(warehouses)];
    const get = createGetCellContent([variant()], columns);
    const opts = cellOpts();

    expect(get([3, 0], opts)).toMatchObject({ data: { value: numberCellEmptyValue } });
    expect(get([4, 0], opts)).toMatchObject({ data: { value: numberCellEmptyValue } });
  });
});

describe("variants grid changes → save inputs", () => {
  const variants = [variant(), variant({ id: "v2", name: "Size 40", sku: null })];

  it("groups changes per variant in row order, with only the changed fields", () => {
    expect(
      getVariantGridUpdates(variants, [
        { row: 1, column: "sku", data: "BT-40" },
        { row: 0, column: "name", data: "Size 39 wide" },
        { row: 0, column: "price", data: { kind: "number-cell", value: 17500 } },
      ]),
    ).toEqual([
      {
        id: "v1",
        input: { name: "Size 39 wide", price: "17500" },
        stocks: [],
      },
      { id: "v2", input: { sku: "BT-40" }, stocks: [] },
    ]);
  });

  it("sends an emptied SKU as an empty string", () => {
    expect(getVariantGridUpdates([variant()], [{ row: 0, column: "sku", data: "" }])).toEqual([
      { id: "v1", input: { sku: "" }, stocks: [] },
    ]);
  });

  it("collects the changed warehouse cells as the stocks update input", () => {
    expect(
      getVariantGridUpdates(variants, [
        { row: 0, column: "warehouse:w1", data: { kind: "number-cell", value: 0 } },
        { row: 0, column: "warehouse:w2", data: { kind: "number-cell", value: 4 } },
      ]),
    ).toEqual([
      {
        id: "v1",
        input: {},
        stocks: [
          { warehouse: "w1", quantity: 0 },
          { warehouse: "w2", quantity: 4 },
        ],
      },
    ]);
  });

  it("never sends a negative, decimal or missing number, and leaves that variant out", () => {
    const changes: DatagridChange[] = [
      { row: 1, column: "name", data: "Size 41" },
      { row: 0, column: "price", data: { kind: "number-cell", value: -1 } },
      { row: 0, column: "warehouse:w1", data: { kind: "number-cell", value: 1.5 } },
      { row: 0, column: "name", data: "Size 39 wide" },
    ];

    expect(getInvalidVariantGridErrors(variants, changes)).toEqual([
      { variantId: "v1", columnId: "price" },
      { variantId: "v1", columnId: "warehouse:w1" },
    ]);
    expect(getVariantGridUpdates(variants, changes)).toEqual([
      { id: "v2", input: { name: "Size 41" }, stocks: [] },
    ]);
  });

  it("does not treat a cleared number cell as an error, and never sends it", () => {
    const cleared: DatagridChange = {
      row: 0,
      column: "warehouse:w1",
      data: { kind: "number-cell", value: numberCellEmptyValue },
    };

    // An emptied cell holds no number: nothing to fix (no red cell), and no stock row to write.
    expect(getInvalidVariantGridErrors(variants, [cleared])).toEqual([]);
    expect(getVariantGridUpdates(variants, [cleared])).toEqual([]);
    // The variant's other edits are saved: a cleared cell no longer blocks them.
    expect(
      getVariantGridUpdates(variants, [cleared, { row: 0, column: "name", data: "x" }]),
    ).toEqual([{ id: "v1", input: { name: "x" }, stocks: [] }]);
  });

  it("ignores changes without a row and text edits of the number columns", () => {
    expect(getVariantGridUpdates(variants, [{ row: 9, column: "name", data: "Gone" }])).toEqual([]);
    expect(getVariantGridUpdates(variants, [{ row: 0, column: "price", data: "12" }])).toEqual([]);
  });
});

describe("rejected variant errors → cells", () => {
  it("maps productVariantUpdate field errors to the name, SKU and price cells", () => {
    expect(
      getVariantFieldErrors("v1", [
        { field: "sku" },
        { field: "price" },
        { field: "name" },
        { field: null },
        { field: "trackInventory" },
      ]),
    ).toEqual([
      { variantId: "v1", columnId: "sku" },
      { variantId: "v1", columnId: "price" },
      { variantId: "v1", columnId: "name" },
    ]);
  });

  it("maps a stock error's input index to that warehouse's column", () => {
    const stocks = [
      { warehouse: "w1", quantity: 3 },
      { warehouse: "w2", quantity: 5 },
    ];

    expect(getVariantStockErrors("v1", stocks, [{ index: 1 }])).toEqual([
      { variantId: "v1", columnId: "warehouse:w2" },
    ]);
  });

  it("marks every changed warehouse cell when the stock error names no input", () => {
    const stocks = [
      { warehouse: "w1", quantity: 3 },
      { warehouse: "w2", quantity: 5 },
    ];

    expect(getVariantStockErrors("v1", stocks, [{ index: null }])).toEqual([
      { variantId: "v1", columnId: "warehouse:w1" },
      { variantId: "v1", columnId: "warehouse:w2" },
    ]);
    expect(getVariantStockErrors("v1", stocks, [])).toEqual([]);
  });

  it("tints only the matching variant's cell", () => {
    const errors = [{ variantId: "v1", columnId: "warehouse:w1" }];

    expect(hasVariantGridError(errors, "v1", "warehouse:w1")).toBe(true);
    expect(hasVariantGridError(errors, "v1", "warehouse:w2")).toBe(false);
    expect(hasVariantGridError(errors, "v2", "warehouse:w1")).toBe(false);
  });
});
