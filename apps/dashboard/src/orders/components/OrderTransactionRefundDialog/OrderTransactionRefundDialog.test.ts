import { describe, expect, it } from "vitest";

import { isValidRefundAmount } from "./OrderTransactionRefundDialog";

describe("refund amount", () => {
  it("is a positive whole amount no greater than what is left", () => {
    expect(isValidRefundAmount("1000", 2500)).toBe(true);
    expect(isValidRefundAmount(" 2500 ", 2500)).toBe(true);
    expect(isValidRefundAmount("2501", 2500)).toBe(false);
    expect(isValidRefundAmount("0", 2500)).toBe(false);
    expect(isValidRefundAmount("10.5", 2500)).toBe(false);
    expect(isValidRefundAmount("", 2500)).toBe(false);
  });
});
