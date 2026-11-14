import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import {
  canBeSorted,
  createGetCellContent,
  type OrderDraftListRow,
  orderDraftListStaticColumnsAdapter,
} from "./datagrid";

const intl = createIntl({ locale: "en" });

const draft = (overrides: Partial<OrderDraftListRow> = {}): OrderDraftListRow => ({
  __typename: "Order",
  id: "o1",
  number: "22",
  created: "2026-11-14T12:00:00Z",
  userEmail: "ada@example.com",
  billingAddress: null,
  total: {
    __typename: "TaxedMoney",
    gross: { __typename: "Money", amount: 4500, currency: "MNT" },
  },
  ...overrides,
});

describe("draft order list grid", () => {
  it("has Saleor's columns without the channel, sort arrows on the sorted one", () => {
    const columns = orderDraftListStaticColumnsAdapter(intl, { sort: "date", asc: true });

    expect(columns.map((column) => column.id)).toEqual(["number", "date", "customer", "total"]);
    expect(columns.find((column) => column.id === "date")?.icon).toBeTruthy();
    expect(columns.find((column) => column.id === "number")?.icon).toBeFalsy();
  });

  it("sorts by number, date and customer only", () => {
    expect(["number", "date", "customer", "total"].map(canBeSorted)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("shows #number, the customer and the total", () => {
    const columns = orderDraftListStaticColumnsAdapter(intl);
    const cell = createGetCellContent([draft()], columns);

    expect(cell([0, 0])).toMatchObject({ kind: GridCellKind.Text, data: "#22" });
    expect(cell([2, 0])).toMatchObject({ data: "ada@example.com" });
    expect(cell([3, 0])).toMatchObject({ kind: GridCellKind.Custom });
    const named = createGetCellContent(
      [
        draft({
          userEmail: null,
          billingAddress: { __typename: "Address", firstName: "Ada", lastName: "L" },
        }),
      ],
      columns,
    );
    expect(named([2, 0])).toMatchObject({ data: "Ada L" });
    expect(createGetCellContent([draft({ userEmail: null })], columns)([2, 0])).toMatchObject({
      data: "-",
    });
  });
});
