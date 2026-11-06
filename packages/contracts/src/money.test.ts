import { describe, expect, it } from "vitest";
import { addMoney, formatDecimal, type Money, mnt, multiplyMoney, parseDecimal } from "./money.ts";

describe("mnt", () => {
  it("creates whole-tögrög amounts", () => {
    expect(mnt(15000)).toEqual({ amountMinor: 15000, currency: "MNT" });
  });

  it("rejects fractions and unsafe integers", () => {
    expect(() => mnt(1.5)).toThrow("safe integer");
    expect(() => mnt(Number.MAX_SAFE_INTEGER + 1)).toThrow("safe integer");
  });
});

describe("parseDecimal and formatDecimal", () => {
  it("convert between strings and whole tögrög", () => {
    expect(parseDecimal("15000", "MNT")).toEqual(mnt(15000));
    expect(parseDecimal(" -250 ", "MNT")).toEqual(mnt(-250));
    expect(formatDecimal(mnt(15000))).toBe("15000");
    expect(formatDecimal(mnt(-250))).toBe("-250");
  });

  it("reject decimals instead of rounding (MNT has none)", () => {
    expect(() => parseDecimal("15000.50", "MNT")).toThrow("at most 0 decimal places");
  });

  it("reject malformed input", () => {
    expect(() => parseDecimal("15,000", "MNT")).toThrow("Invalid decimal");
    expect(() => parseDecimal("1e3", "MNT")).toThrow("Invalid decimal");
    expect(() => parseDecimal("", "MNT")).toThrow("Invalid decimal");
  });
});

describe("arithmetic", () => {
  it("adds amounts in the same currency", () => {
    expect(addMoney(mnt(15000), mnt(2500))).toEqual(mnt(17500));
  });

  it("refuses to mix currencies", () => {
    // Only MNT exists today; this guards the day a second currency is added.
    const usd = { amountMinor: 100, currency: "USD" } as unknown as Money;
    expect(() => addMoney(mnt(1), usd)).toThrow("Currency mismatch");
  });

  it("multiplies by whole quantities only", () => {
    expect(multiplyMoney(mnt(15000), 3)).toEqual(mnt(45000));
    expect(() => multiplyMoney(mnt(15000), 1.5)).toThrow("integer");
  });

  it("throws instead of silently losing precision on overflow", () => {
    expect(() => multiplyMoney(mnt(Number.MAX_SAFE_INTEGER), 2)).toThrow("safe integer");
  });
});
