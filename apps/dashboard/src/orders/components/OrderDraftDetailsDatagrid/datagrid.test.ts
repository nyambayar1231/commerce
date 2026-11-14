import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { GetCellContentOpts } from "../../../components/Datagrid/Datagrid";
import type { DatagridChange } from "../../../components/Datagrid/hooks/useDatagridChange";
import type { OrderErrorFragment, OrderLineFragment } from "../../../graphql/types.generated";
import { createGetCellContent, orderDraftDetailsStaticColumnsAdapter } from "./datagrid";

const intl = createIntl({ locale: "en", messages: {} });
const columns = orderDraftDetailsStaticColumnsAdapter(intl);
const column = (id: string) => columns.findIndex((candidate) => candidate.id === id);

const money = (amount: number) => ({ __typename: "Money" as const, amount, currency: "MNT" });
const taxed = (amount: number) => ({
  __typename: "TaxedMoney" as const,
  gross: money(amount),
  tax: money(0),
});

const line = (overrides: Partial<OrderLineFragment> = {}): OrderLineFragment => ({
  __typename: "OrderLine",
  id: "l1",
  productName: "Shirt",
  productSku: "S-1",
  variantName: "M",
  quantity: 2,
  quantityFulfilled: 0,
  quantityToFulfill: 2,
  unitPrice: taxed(1000),
  totalPrice: taxed(2000),
  variant: {
    __typename: "ProductVariant",
    id: "v1",
    product: { __typename: "Product", id: "p1", thumbnail: null },
  },
  ...overrides,
});

const opts = (changes: DatagridChange[] = []): GetCellContentOpts => ({
  changes: { current: changes },
  getChangeIndex: (columnId, row) =>
    changes.findIndex((change) => change.column === columnId && change.row === row),
});

const getCell = (
  lines: OrderLineFragment[],
  errors: OrderErrorFragment[] = [],
  changes: DatagridChange[] = [],
) => {
  const getCellContent = createGetCellContent({
    columns,
    lines,
    errors,
    intl,
    theme: "defaultLight",
  });

  return (columnId: string, row = 0) => getCellContent([column(columnId), row], opts(changes));
};

describe("draft lines grid cells", () => {
  it("uses Saleor's default columns minus is gift and metadata", () => {
    expect(columns.map((candidate) => candidate.id)).toEqual([
      "product",
      "status",
      "sku",
      "variantName",
      "quantity",
      "price",
      "total",
    ]);
  });

  it("makes only the quantity editable, showing an unsaved edit", () => {
    const cell = getCell([line()]);

    expect(cell("quantity")).toMatchObject({ readonly: false, data: { value: 2 } });
    expect(cell("price")).toMatchObject({ readonly: true, data: { value: 1000 } });
    expect(cell("sku")).toMatchObject({ readonly: true, data: "S-1" });

    const edited = getCell(
      [line()],
      [],
      [{ row: 0, column: "quantity", data: { kind: "number-cell", value: 7 } }],
    );
    expect(edited("quantity")).toMatchObject({ data: { value: 7 } });
  });

  it("shows Finalize's error for the line, else a deleted product", () => {
    const stock: OrderErrorFragment = {
      __typename: "OrderError",
      code: "INSUFFICIENT_STOCK",
      field: "lines",
      message: "Insufficient product stock.",
      orderLines: ["l1"],
      warehouse: null,
      addressType: null,
    };

    expect(getCell([line()], [stock])("status")).toMatchObject({
      data: { value: "Cannot change the quantity because of insufficient stock" },
    });
    expect(getCell([line({ variant: null })])("status")).toMatchObject({
      data: { value: "Product no longer exists" },
    });
    expect(getCell([line()])("status")).toMatchObject({ data: "" });
  });
});
