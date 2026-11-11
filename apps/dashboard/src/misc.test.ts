import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import {
  getStatusColor,
  getUserInitials,
  getUserName,
  type OrderPaymentSummary,
  transformOrderStatus,
  transformPaymentStatus,
} from "./misc";

const named = { email: "ada@example.com", firstName: "Ada", lastName: "lovelace" };
const unnamed = { email: "ada@example.com", firstName: "", lastName: "" };

describe("getUserName", () => {
  it("joins first and last name", () => {
    expect(getUserName(named, true)).toBe("Ada lovelace");
  });

  it("falls back to the email, or its local part", () => {
    expect(getUserName(unnamed, true)).toBe("ada@example.com");
    expect(getUserName(unnamed)).toBe("ada");
  });

  it("is undefined without a user", () => {
    expect(getUserName(null)).toBeUndefined();
  });
});

describe("getUserInitials", () => {
  it("uses the name's initials, upper-cased", () => {
    expect(getUserInitials(named)).toBe("AL");
  });

  it("falls back to the first two letters of the email", () => {
    expect(getUserInitials(unnamed)).toBe("AD");
  });

  it("is undefined without a user", () => {
    expect(getUserInitials()).toBeUndefined();
  });
});

const intl = createIntl({ locale: "en" });

const payment = (overrides: Partial<OrderPaymentSummary> = {}): OrderPaymentSummary => ({
  chargeStatus: "NONE",
  authorizeStatus: "NONE",
  totalCharged: { amount: 0 },
  totalChargePending: { amount: 0 },
  totalRefunded: { amount: 0 },
  ...overrides,
});

describe("transformPaymentStatus", () => {
  it("follows Saleor's precedence: overcharged, pending, refunds, charge, authorize", () => {
    const label = (overrides: Partial<OrderPaymentSummary>) =>
      transformPaymentStatus(payment(overrides), intl);

    expect(label({ chargeStatus: "OVERCHARGED", totalChargePending: { amount: 5 } })).toEqual({
      localized: "Overcharged",
      status: "warning",
    });
    expect(label({ chargeStatus: "FULL", totalChargePending: { amount: 5 } }).localized).toBe(
      "Pending",
    );
    expect(label({ totalRefunded: { amount: 5 }, totalCharged: { amount: 5 } })).toEqual({
      localized: "Partially refunded",
      status: "attention",
    });
    expect(label({ totalRefunded: { amount: 5 } }).localized).toBe("Fully refunded");
    expect(label({ chargeStatus: "FULL" })).toEqual({ localized: "Fully paid", status: "success" });
    expect(label({ chargeStatus: "PARTIAL" }).localized).toBe("Partially paid");
    expect(label({ authorizeStatus: "FULL" }).localized).toBe("Authorised");
    expect(label({ authorizeStatus: "PARTIAL" }).localized).toBe("Partially authorised");
    expect(label({})).toEqual({ localized: "Unpaid", status: "neutral" });
  });
});

describe("transformOrderStatus", () => {
  it("labels and colors each status as Saleor", () => {
    expect(transformOrderStatus("UNFULFILLED", intl)).toEqual({
      localized: "Unfulfilled",
      status: "warning",
    });
    expect(transformOrderStatus("PARTIALLY_FULFILLED", intl).status).toBe("info");
    expect(transformOrderStatus("FULFILLED", intl).status).toBe("success");
    expect(transformOrderStatus("CANCELED", intl)).toEqual({
      localized: "Cancelled",
      status: "error",
    });
  });
});

describe("getStatusColor", () => {
  it("uses the status hue, and a neutral pill for neutral statuses", () => {
    expect(getStatusColor({ status: "success", currentTheme: "defaultLight" }).base).toBe(
      "oklch(94% 0.065 135)",
    );
    expect(getStatusColor({ status: "neutral", currentTheme: "defaultDark" }).base).toBe(
      "oklch(25% 0 0 / 0.3)",
    );
  });
});
