import { describe, expect, it } from "vitest";
import type { PaymentTransactionRow } from "../payments/index.ts";
import { orderPaymentSummary } from "./payments.ts";

// Saleor's order charge/authorize rules (saleor/order/utils.py), without granted refunds.
const mnt = (amountMinor: number) => ({ amountMinor, currency: "MNT" as const });
const tx = (authorizedAmount: number, chargedAmount: number, refundedAmount = 0) =>
  ({ authorizedAmount, chargedAmount, refundedAmount, currency: "MNT" }) as PaymentTransactionRow;

describe("orderPaymentSummary", () => {
  it.each([
    [[], "NONE", "NONE"],
    [[tx(0, 400)], "PARTIAL", "PARTIAL"],
    [[tx(600, 400)], "PARTIAL", "FULL"],
    [[tx(0, 1000)], "FULL", "FULL"],
    [[tx(0, 1500)], "OVERCHARGED", "FULL"],
    [[tx(0, 1000, 300)], "PARTIAL", "PARTIAL"],
    [[tx(0, 1000, 1000)], "NONE", "NONE"],
  ] as const)(
    "%j on a 1000 order is charge %s, authorize %s",
    (transactions, charge, authorize) => {
      const summary = orderPaymentSummary(mnt(1000), transactions);
      expect([summary.chargeStatus, summary.authorizeStatus]).toEqual([charge, authorize]);
    },
  );

  it("reports charged net of refunds, refunds and the balance", () => {
    // 200 authorized + 700 net charged covers 900 of 1000: both statuses are partial.
    expect(orderPaymentSummary(mnt(1000), [tx(200, 1000, 300)])).toEqual({
      chargeStatus: "PARTIAL",
      authorizeStatus: "PARTIAL",
      totalCharged: mnt(700),
      totalAuthorized: mnt(200),
      totalRefunded: mnt(300),
      totalBalance: mnt(-300),
    });
  });

  it("treats a free order as fully paid", () => {
    expect(orderPaymentSummary(mnt(0), [])).toMatchObject({
      chargeStatus: "FULL",
      authorizeStatus: "FULL",
    });
  });
});
