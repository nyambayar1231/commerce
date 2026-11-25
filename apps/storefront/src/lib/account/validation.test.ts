import { describe, expect, it } from "vitest";
import type { AddressField } from "./types";
import {
  addressErrorsFromApi,
  readAddressValues,
  validateAddress,
  validatePasswordChange,
  validateProfile,
} from "./validation";

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
  phone: "99112233",
};

describe("validateAddress", () => {
  it("accepts a complete Mongolian address", () => {
    expect(validateAddress(valid)).toBeNull();
  });
  it("reports every missing required field at once", () => {
    expect(validateAddress({ ...valid, firstName: " ", city: "", streetAddress1: "" })).toEqual({
      firstName: "required",
      city: "required",
      streetAddress1: "required",
    });
  });
  it("rejects an unknown country and an over-long field", () => {
    expect(validateAddress({ ...valid, country: "ZZ" })).toEqual({ country: "invalid" });
    expect(validateAddress({ ...valid, postalCode: "1".repeat(21) })).toEqual({
      postalCode: "tooLong",
    });
  });
});

describe("readAddressValues", () => {
  it("reads every field, missing ones as empty", () => {
    const form = new FormData();
    form.set("firstName", "Бат");
    expect(readAddressValues(form)).toMatchObject({ firstName: "Бат", city: "", country: "" });
  });
});

describe("addressErrorsFromApi", () => {
  it("maps codes to the fields they belong to", () => {
    expect(
      addressErrorsFromApi([
        { code: "REQUIRED", field: "city" },
        { code: "INVALID", field: "phone" },
      ]),
    ).toEqual({ fieldErrors: { city: "required", phone: "invalid" }, message: undefined });
  });
  it("a not-found address is a form-level message", () => {
    expect(addressErrorsFromApi([{ code: "NOT_FOUND", field: "id" }])).toEqual({
      fieldErrors: {},
      message: "notFound",
    });
  });
  it("an error with no known field is not lost", () => {
    expect(addressErrorsFromApi([{ code: "INVALID", field: null }]).message).toBe("generic");
  });
});

describe("validateProfile", () => {
  it("accepts empty and normal names, rejects an over-long one", () => {
    expect(validateProfile({ firstName: "", lastName: "" })).toBeNull();
    expect(validateProfile({ firstName: "a".repeat(257), lastName: "Болд" })).toEqual({
      firstName: "tooLong",
    });
  });
});

describe("validatePasswordChange", () => {
  const ok = { oldPassword: "old-password", password: "new-password-1", confirm: "new-password-1" };
  it("accepts a good change", () => {
    expect(validatePasswordChange(ok)).toBeNull();
  });
  it("needs the current password", () => {
    expect(validatePasswordChange({ ...ok, oldPassword: "" })).toEqual({
      oldPassword: "passwordRequired",
    });
  });
  it("needs 8 characters and a matching confirmation", () => {
    expect(validatePasswordChange({ ...ok, password: "short", confirm: "short" })).toEqual({
      password: "passwordTooShort",
    });
    expect(validatePasswordChange({ ...ok, confirm: "other-password" })).toEqual({
      confirm: "passwordsMismatch",
    });
  });
});
