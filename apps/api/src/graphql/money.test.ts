import { mnt } from "@commerce/contracts";
import { describe, expect, it } from "vitest";
import { moneyAmount } from "./money.ts";

describe("Money (GraphQL)", () => {
  it("gives MNT's amount in whole tögrög (exponent 0)", () => {
    expect(moneyAmount(mnt(15000))).toBe(15000);
    expect(moneyAmount(mnt(0))).toBe(0);
  });
});
