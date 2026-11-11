import { describe, expect, it } from "vitest";
import { cleanAddress, parseStoredAddress } from "./addresses.ts";

// Address cleaning without a database (PLAN M5 decision 3: required fields + a known country).
const VALID = {
  firstName: " Bat ",
  lastName: "Dorj",
  streetAddress1: "Peace Avenue 1",
  city: "Ulaanbaatar",
  country: "mn",
};

describe("cleanAddress", () => {
  it("trims every field, upper-cases the country and fills absent fields with empty strings", () => {
    expect(cleanAddress(VALID)).toEqual({
      ok: true,
      address: {
        firstName: "Bat",
        lastName: "Dorj",
        companyName: "",
        streetAddress1: "Peace Avenue 1",
        streetAddress2: "",
        city: "Ulaanbaatar",
        cityArea: "",
        postalCode: "",
        country: "MN",
        countryArea: "",
        phone: "",
      },
    });
  });

  it("reports every missing required field at once", () => {
    const result = cleanAddress({ firstName: "  ", companyName: "Acme" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => [error.field, error.code])).toEqual([
      ["firstName", "REQUIRED"],
      ["lastName", "REQUIRED"],
      ["streetAddress1", "REQUIRED"],
      ["city", "REQUIRED"],
      ["country", "REQUIRED"],
    ]);
  });

  it("rejects an unknown country code and over-long values", () => {
    const result = cleanAddress({ ...VALID, country: "XX", postalCode: "1".repeat(21) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => [error.field, error.code])).toEqual([
      ["postalCode", "INVALID"],
      ["country", "INVALID"],
    ]);
  });
});

describe("parseStoredAddress", () => {
  it("reads a stored snapshot back and treats null as no address", () => {
    const cleaned = cleanAddress(VALID);
    if (!cleaned.ok) throw new Error("invalid fixture");
    expect(parseStoredAddress(JSON.parse(JSON.stringify(cleaned.address)))).toEqual(
      cleaned.address,
    );
    expect(parseStoredAddress(null)).toBeNull();
  });

  it("refuses corrupt data instead of guessing", () => {
    expect(() => parseStoredAddress({ city: "x" })).toThrow();
  });
});
