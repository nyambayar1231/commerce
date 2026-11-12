import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import {
  type CustomerListRow,
  createGetCellContent,
  customerListStaticColumnsAdapter,
} from "./datagrid";

const intl = createIntl({ locale: "en" });

const customer = (overrides: Partial<CustomerListRow> = {}): CustomerListRow => ({
  __typename: "User",
  id: "u1",
  email: "bat@example.com",
  firstName: "Bat",
  lastName: "Dorj",
  orders: { __typename: "OrderCountableConnection", totalCount: 3 },
  ...overrides,
});

describe("customer list columns", () => {
  it("are Saleor's columns, the order count only for staff who may read orders", () => {
    const withOrders = customerListStaticColumnsAdapter(intl, { sort: "name", asc: true }, true);

    expect(withOrders.map((column) => [column.id, column.title, column.width])).toEqual([
      ["name", "Customer name", 450],
      ["email", "Customer e-mail", 450],
      ["orders", "No. of orders", 200],
    ]);
    expect(withOrders[0]?.icon).toBeDefined();
    expect(withOrders[1]?.icon).toBeUndefined();
    expect(
      customerListStaticColumnsAdapter(intl, undefined, false).map((column) => column.id),
    ).toEqual(["name", "email"]);
  });
});

describe("customer list cells", () => {
  const columns = customerListStaticColumnsAdapter(intl, undefined, true);
  const text = (row: CustomerListRow, column: number) => {
    const cell = createGetCellContent([row], columns)([column, 0]);

    return "data" in cell ? cell.data : undefined;
  };

  it("shows the full name, email and order count", () => {
    expect([0, 1, 2].map((column) => text(customer(), column))).toEqual([
      "Bat Dorj",
      "bat@example.com",
      "3",
    ]);
  });

  it("falls back to the email's name part, as Saleor's getUserName", () => {
    expect(text(customer({ firstName: "", lastName: "" }), 0)).toBe("bat");
    expect(text(customer({ orders: undefined }), 2)).toBe("");
  });
});
