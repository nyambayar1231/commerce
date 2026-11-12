import { describe, expect, it } from "vitest";

import {
  buildCustomerOrderKpiMetrics,
  type CustomerOrderForKpi,
  formatMoneyAmount,
  selectRecentOrdersForKpis,
} from "./utils";

const order = (
  status: string,
  created: string,
  net: number,
  shipping = 0,
  refunded = 0,
): CustomerOrderForKpi => ({
  status,
  created,
  subtotal: { net: { amount: net, currency: "MNT" } },
  shippingPrice: { gross: { amount: shipping, currency: "MNT" } },
  totalRefunded: { amount: refunded, currency: "MNT" },
});

describe("customer KPI metrics", () => {
  it("leave out cancelled orders and keep the newest ones first", () => {
    const orders = [
      order("FULFILLED", "2026-11-01T00:00:00Z", 1),
      order("CANCELED", "2026-11-03T00:00:00Z", 2),
      order("UNFULFILLED", "2026-11-02T00:00:00Z", 3),
    ];

    expect(selectRecentOrdersForKpis(orders).map((o) => o.subtotal.net.amount)).toEqual([3, 1]);
    expect(selectRecentOrdersForKpis(orders, 1)).toHaveLength(1);
  });

  it("sum the products of the window, average them and total shipping and refunds", () => {
    expect(
      buildCustomerOrderKpiMetrics([
        order("FULFILLED", "2026-11-01T00:00:00Z", 30000, 5000, 10000),
        order("UNFULFILLED", "2026-11-02T00:00:00Z", 60000, 5000),
        order("CANCELED", "2026-11-03T00:00:00Z", 99999),
      ]),
    ).toEqual({
      windowSize: 2,
      orderCount: 2,
      currency: "MNT",
      netSales: { amount: 90000, currency: "MNT" },
      aov: { amount: 45000, currency: "MNT" },
      shippingTotal: { amount: 10000, currency: "MNT" },
      refundedTotal: { amount: 10000, currency: "MNT" },
    });
    expect(buildCustomerOrderKpiMetrics([order("CANCELED", "2026-11-03T00:00:00Z", 1)])).toBeNull();
  });

  it("format whole amounts without the currency (MNT has no minor unit)", () => {
    expect(formatMoneyAmount({ amount: 45000, currency: "MNT" }, "en")).toBe("45,000");
    expect(formatMoneyAmount({ amount: 33333.5, currency: "MNT" }, "en")).toBe("33,334");
  });
});
