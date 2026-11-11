import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { OrderLineFragment } from "../../../graphql/types.generated";
import {
  createGetCellContent,
  orderDetailsStaticColumnsAdapter,
  toLineWithUnfulfilledQuantity,
} from "./datagrid";

const intl = createIntl({ locale: "en" });
const money = (amount: number) => ({
  __typename: "TaxedMoney" as const,
  gross: { __typename: "Money" as const, amount, currency: "MNT" },
});

const line = (overrides: Partial<OrderLineFragment> = {}): OrderLineFragment => ({
  __typename: "OrderLine",
  id: "l1",
  productName: "Boots",
  productSku: "BOOTS-42",
  variantName: "42",
  quantity: 3,
  quantityFulfilled: 0,
  unitPrice: money(1000),
  totalPrice: money(3000),
  variant: {
    __typename: "ProductVariant",
    id: "v1",
    product: { __typename: "Product", id: "p1", thumbnail: { __typename: "Image", url: "t.png" } },
  },
  ...overrides,
});

describe("order lines grid", () => {
  it("counts what is left to fulfil and drops fulfilled lines", () => {
    expect(
      toLineWithUnfulfilledQuantity([
        line({ quantityFulfilled: 1 }),
        line({ id: "l2", quantityFulfilled: 3 }),
      ]).map((l) => [l.id, l.quantity]),
    ).toEqual([["l1", 2]]);
  });

  it("shows product, SKU, variant, quantity, price and total", () => {
    const columns = orderDetailsStaticColumnsAdapter(intl);
    const cell = createGetCellContent(columns, [line()]);
    const data = (col: number) => (cell([col, 0]) as { data: unknown }).data;

    expect(columns.map((column) => column.id)).toEqual([
      "product",
      "sku",
      "variantName",
      "quantity",
      "price",
      "total",
    ]);
    expect(data(0)).toEqual({ kind: "thumbnail-cell", image: "t.png", name: "Boots" });
    expect(cell([1, 0])).toMatchObject({ kind: GridCellKind.Text, data: "BOOTS-42" });
    expect(cell([2, 0])).toMatchObject({ data: "42" });
    expect(cell([3, 0])).toMatchObject({ data: "3" });
    expect(data(4)).toEqual({ kind: "money-cell", value: 1000, currency: "MNT" });
    expect(data(5)).toEqual({ kind: "money-cell", value: 3000, currency: "MNT" });
  });

  it("shows a placeholder thumbnail when the variant is gone", () => {
    const cell = createGetCellContent(orderDetailsStaticColumnsAdapter(intl), [
      line({ variant: null }),
    ]);

    expect((cell([0, 0]) as unknown as { data: { image: string } }).data.image).toBe("");
  });
});
