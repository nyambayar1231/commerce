import { describe, expect, it } from "vitest";

import {
  canSubmitFulfillment,
  type FulfillFormLine,
  type FulfillLine,
  getAvailableQuantity,
  getDefaultFulfillWarehouse,
  getFulfillSubmitLines,
  getToFulfillLines,
  initialFormLines,
} from "./fulfill";

const main = { __typename: "Warehouse" as const, id: "w1", name: "Main" };

const line = (overrides: Partial<FulfillLine> = {}): FulfillLine => ({
  __typename: "OrderLine",
  id: "l1",
  productName: "Boots",
  productSku: "B-42",
  variantName: "42",
  quantity: 3,
  quantityToFulfill: 2,
  variant: {
    __typename: "ProductVariant",
    id: "v1",
    trackInventory: true,
    product: { __typename: "Product", id: "p1", thumbnail: null },
    stocks: [
      { __typename: "Stock", id: "s1", quantity: 10, quantityAllocated: 6, warehouse: main },
    ],
  },
  ...overrides,
});

describe("fulfill page rules", () => {
  it("lists only lines with something left, prefilled with all of it from the stock's warehouse", () => {
    const lines = getToFulfillLines([line(), line({ id: "l2", quantityToFulfill: 0 })]);

    expect(lines.map((item) => item.id)).toEqual(["l1"]);
    expect(initialFormLines(lines, [])).toEqual([{ lineId: "l1", quantity: 2, warehouse: main }]);
  });

  it("falls back to the first warehouse for an untracked or deleted variant", () => {
    const other = { id: "w2", name: "Other" };

    expect(getDefaultFulfillWarehouse(line({ variant: null }), [other])).toEqual(other);
    expect(getDefaultFulfillWarehouse(line({ variant: null }), [])).toBeNull();
  });

  it("counts free stock plus the line's own reservation; none for untracked variants", () => {
    // 10 − 6 allocated + the line's 2 reserved units.
    expect(getAvailableQuantity(line(), "w1")).toBe(6);
    expect(getAvailableQuantity(line(), "w9")).toBe(0);
    const variant = line().variant;
    if (!variant) throw new Error("no variant");
    expect(
      getAvailableQuantity(line({ variant: { ...variant, trackInventory: false } }), "w1"),
    ).toBeNull();
  });

  it("submits only when something is fulfilled, nothing is over and warehouses are set", () => {
    const lines = [line(), line({ id: "l2", quantityToFulfill: 1 })];
    const [first, second] = initialFormLines(lines, [main]) as [FulfillFormLine, FulfillFormLine];
    const form = [first, second];

    expect(canSubmitFulfillment(form, lines)).toBe(true);
    expect(
      canSubmitFulfillment(
        form.map((row) => ({ ...row, quantity: 0 })),
        lines,
      ),
    ).toBe(false);
    expect(canSubmitFulfillment([{ ...first, quantity: 3 }, second], lines)).toBe(false);
    expect(canSubmitFulfillment([{ ...first, warehouse: null }, second], lines)).toBe(false);
    expect(canSubmitFulfillment([{ ...first, quantity: 0, warehouse: null }, second], lines)).toBe(
      true,
    );
  });

  it("sends Saleor's orderFulfill lines without zero rows", () => {
    expect(
      getFulfillSubmitLines([
        { lineId: "l1", quantity: 2, warehouse: main },
        { lineId: "l2", quantity: 0, warehouse: main },
      ]),
    ).toEqual([{ orderLineId: "l1", stocks: [{ quantity: 2, warehouse: "w1" }] }]);
  });
});
