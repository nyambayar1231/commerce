import { describe, expect, it } from "vitest";
import {
  textField,
  validateEmail,
  validateLogin,
  validateNewPassword,
  validateRegister,
} from "./validation";

describe("validation", () => {
  it("validateLogin needs a well-formed email and a password", () => {
    expect(validateLogin({ email: "a@b.mn", password: "x" })).toBeNull();
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "required",
      password: "passwordRequired",
    });
    expect(validateLogin({ email: "not-an-email", password: "x" })).toEqual({
      email: "invalidEmail",
    });
    expect(validateLogin({ email: "a b@c.mn", password: "x" })).toEqual({ email: "invalidEmail" });
  });
  it("validateNewPassword needs 8 characters and a matching confirmation", () => {
    expect(validateNewPassword({ password: "12345678", confirm: "12345678" })).toBeNull();
    expect(validateNewPassword({ password: "1234567", confirm: "1234567" })).toEqual({
      password: "passwordTooShort",
    });
    expect(validateNewPassword({ password: "12345678", confirm: "12345679" })).toEqual({
      confirm: "passwordsMismatch",
    });
    expect(validateNewPassword({ password: "", confirm: "" })).toEqual({
      password: "passwordRequired",
    });
  });
  it("validateRegister combines the email and password rules", () => {
    expect(
      validateRegister({ email: "a@b.mn", password: "12345678", confirm: "12345678" }),
    ).toBeNull();
    expect(validateRegister({ email: "x", password: "123", confirm: "1234" })).toEqual({
      email: "invalidEmail",
      password: "passwordTooShort",
      confirm: "passwordsMismatch",
    });
  });
  it("validateEmail", () => {
    expect(validateEmail("a@b.mn")).toBeNull();
    expect(validateEmail("a@b")).toEqual({ email: "invalidEmail" });
  });
  it("textField gives '' for a missing or non-text field", () => {
    const form = new FormData();
    form.set("a", "x");
    form.set("f", new Blob(["x"]), "f.txt");
    expect(textField(form, "a")).toBe("x");
    expect(textField(form, "missing")).toBe("");
    expect(textField(form, "f")).toBe("");
  });
});
