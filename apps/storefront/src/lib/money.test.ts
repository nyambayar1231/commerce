import { describe, expect, it } from "vitest";
import { toMoney } from "./money";

describe("toMoney", () => {
  it("converts MNT", () => {
    expect(toMoney({ amount: 15000, currency: "MNT" })).toEqual({
      amountMinor: 15000,
      currency: "MNT",
    });
  });
  it("throws on an unknown currency", () => {
    expect(() => toMoney({ amount: 1, currency: "USD" })).toThrow(/Unknown currency/);
  });
});
