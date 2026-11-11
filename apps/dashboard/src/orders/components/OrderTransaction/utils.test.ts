import { describe, expect, it } from "vitest";

import type { TransactionItemFragment } from "../../../graphql/types.generated";
import { getTransactionAmounts, mapTransactionEvent, shouldShowAmount } from "./utils";

const money = (amount: number) => ({ __typename: "Money" as const, amount, currency: "MNT" });

describe("transaction tile helpers", () => {
  it("maps event types to Saleor's type and status", () => {
    expect(mapTransactionEvent("CHARGE_SUCCESS")).toEqual({ type: "CHARGE", status: "SUCCESS" });
    expect(mapTransactionEvent("REFUND_REQUEST")).toEqual({ type: "REFUND", status: "REQUEST" });
    expect(mapTransactionEvent("AUTHORIZATION_FAILURE")).toEqual({
      type: "AUTHORIZATION",
      status: "FAILED",
    });
    expect(mapTransactionEvent(null)).toEqual({ type: null, status: "INFO" });
  });

  it("hides the amount of cancel events", () => {
    expect(shouldShowAmount("CANCEL_SUCCESS")).toBe(false);
    expect(shouldShowAmount("CHARGE_SUCCESS")).toBe(true);
  });

  it("lists only non-zero amounts, charged first", () => {
    const transaction = {
      chargedAmount: money(2500),
      authorizedAmount: money(0),
      refundedAmount: money(500),
      canceledAmount: money(0),
      chargePendingAmount: money(0),
      authorizePendingAmount: money(0),
      refundPendingAmount: money(0),
      cancelPendingAmount: money(0),
    } as TransactionItemFragment;

    expect(
      getTransactionAmounts(transaction).map(({ label, money }) => [
        label.defaultMessage,
        money.amount,
      ]),
    ).toEqual([
      ["Charged", 2500],
      ["Refunded", 500],
    ]);
  });
});
