import { mnt } from "@commerce/contracts";
import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats MNT with the narrow symbol and no decimals", () => {
    // The symbol, one no-break space (U+00A0), then comma grouping.
    expect(formatMoney(mnt(1234567))).toBe("₮\u00a01,234,567");
  });
});

describe("formatDate", () => {
  it("uses Asia/Ulaanbaatar (UTC+8): 20:00Z is already the next day", () => {
    expect(formatDate("2026-11-24T20:00:00Z", "long")).toContain("25");
    expect(formatDate("2026-11-24T10:00:00Z", "long")).toContain("24");
  });
  it("short and long differ", () => {
    expect(formatDate("2026-11-24T10:00:00Z", "short")).not.toBe(
      formatDate("2026-11-24T10:00:00Z", "long"),
    );
  });
});
