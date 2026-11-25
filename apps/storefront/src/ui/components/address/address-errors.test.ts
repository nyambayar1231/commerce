import { describe, expect, it } from "vitest";
import type { AddressField } from "@/lib/account/types";
import { clientAddressErrors, readAddressForm } from "./address-errors";

const valid: Record<AddressField, string> = {
  firstName: "Бат",
  lastName: "Болд",
  companyName: "",
  country: "MN",
  countryArea: "Улаанбаатар",
  city: "Сүхбаатар дүүрэг",
  cityArea: "1-р хороо",
  streetAddress1: "Энхтайваны өргөн чөлөө 5",
  streetAddress2: "",
  postalCode: "",
  phone: "",
};

describe("clientAddressErrors", () => {
  it("is null for a complete address (postal code and phone are optional)", () => {
    expect(clientAddressErrors(valid)).toBeNull();
  });

  it("maps cleanAddress's errors to message keys per form field", () => {
    expect(clientAddressErrors({ ...valid, lastName: "", streetAddress1: "  " })).toEqual({
      lastName: "required",
      streetAddress1: "required",
    });
    expect(clientAddressErrors({ ...valid, country: "ZZ" })).toEqual({ country: "invalid" });
    expect(clientAddressErrors({ ...valid, phone: "9".repeat(129) })).toEqual({
      phone: "tooLong",
    });
  });
});

describe("readAddressForm", () => {
  it("reads the Mongolian address fields from a submitted form", () => {
    const form = new FormData();
    form.set("countryArea", "Улаанбаатар"); // aimag or capital
    form.set("city", "Сүхбаатар дүүрэг"); // sum or district
    form.set("cityArea", "1-р хороо"); // bag or khoroo
    form.set("streetAddress1", "Энхтайваны өргөн чөлөө 5");
    expect(readAddressForm(form)).toMatchObject({
      countryArea: "Улаанбаатар",
      city: "Сүхбаатар дүүрэг",
      cityArea: "1-р хороо",
      streetAddress1: "Энхтайваны өргөн чөлөө 5",
      firstName: "",
    });
  });
});
