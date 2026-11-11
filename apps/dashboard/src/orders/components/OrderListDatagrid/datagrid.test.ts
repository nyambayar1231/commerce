import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import {
  canBeSorted,
  createGetCellContent,
  getCustomerCellText,
  type OrderListRow,
  orderListStaticColumnAdapter,
} from "./datagrid";

const intl = createIntl({ locale: "en" });

const order = (overrides: Partial<OrderListRow> = {}): OrderListRow => ({
  __typename: "Order",
  id: "o1",
  number: "1001",
  created: "2026-11-10T12:00:00Z",
  status: "UNFULFILLED",
  userEmail: "ada@example.com",
  billingAddress: { __typename: "Address", firstName: "Ada", lastName: "Lovelace" },
  total: {
    __typename: "TaxedMoney",
    gross: { __typename: "Money", amount: 25000, currency: "MNT" },
  },
  chargeStatus: "FULL",
  authorizeStatus: "NONE",
  totalCharged: { __typename: "Money", amount: 25000 },
  totalChargePending: { __typename: "Money", amount: 0 },
  totalRefunded: { __typename: "Money", amount: 0 },
  ...overrides,
});

describe("order list columns", () => {
  it("are Saleor's columns we can fill, with the sort arrow on the sorted one", () => {
    const columns = orderListStaticColumnAdapter(intl, { sort: "number", asc: false });

    expect(columns.map((column) => column.id)).toEqual([
      "number",
      "date",
      "customer",
      "payment",
      "status",
      "total",
    ]);
    expect(columns[0]?.icon).toBe("arrowDown");
    expect(columns.at(-1)?.headerAlign).toBe("right");
  });

  it("sort by every column but total", () => {
    expect(["number", "date", "customer", "payment", "status"].every(canBeSorted)).toBe(true);
    expect(canBeSorted("total")).toBe(false);
  });
});

describe("order list cells", () => {
  it("shows the billing name, else the email, else a dash", () => {
    expect(getCustomerCellText(order())).toBe("Ada Lovelace");
    expect(getCustomerCellText(order({ billingAddress: null }))).toBe("ada@example.com");
    expect(getCustomerCellText(order({ billingAddress: null, userEmail: null }))).toBe("-");
  });

  it("draws number as text, date, pills and money", () => {
    const columns = orderListStaticColumnAdapter(intl);
    const cell = createGetCellContent([order()], columns, { intl, theme: "defaultLight" });
    const data = (col: number) => (cell([col, 0]) as { data: unknown }).data;

    expect(cell([0, 0])).toMatchObject({ kind: GridCellKind.Text, data: "1001" });
    expect(data(1)).toEqual({ kind: "date-cell", value: "2026-11-10T12:00:00Z" });
    expect(data(3)).toMatchObject({ kind: "auto-tags-cell", value: "Fully paid" });
    expect(data(4)).toMatchObject({ kind: "auto-tags-cell", value: "Unfulfilled" });
    expect(data(5)).toEqual({ kind: "money-cell", value: 25000, currency: "MNT" });
  });

  it("is empty past the last row", () => {
    const cell = createGetCellContent([], orderListStaticColumnAdapter(intl), {
      intl,
      theme: "defaultLight",
    });

    expect(cell([0, 0])).toMatchObject({ kind: GridCellKind.Text, data: "" });
  });
});
