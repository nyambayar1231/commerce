import { describe, expect, it } from "vitest";
import { slugify } from "./index.ts";

describe("slugify", () => {
  it.each([
    ["Gift Cards", "gift-cards"],
    ["Хувцас", "khuvtsas"],
    ["Өвлийн гутал", "ovliin-gutal"],
    ["  Café  & Bar!! ", "cafe-bar"],
    ["!!!", "-"],
    ["Saleor Хувцас 2026", "saleor-khuvtsas-2026"],
    ["Үнэт эдлэл", "unet-edlel"],
    ["ӨВЛИЙН ГУТАЛ", "ovliin-gutal"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
