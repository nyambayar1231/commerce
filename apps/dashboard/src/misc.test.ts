import { describe, expect, it } from "vitest";

import { getUserInitials, getUserName } from "./misc";

const named = { email: "ada@example.com", firstName: "Ada", lastName: "lovelace" };
const unnamed = { email: "ada@example.com", firstName: "", lastName: "" };

describe("getUserName", () => {
  it("joins first and last name", () => {
    expect(getUserName(named, true)).toBe("Ada lovelace");
  });

  it("falls back to the email, or its local part", () => {
    expect(getUserName(unnamed, true)).toBe("ada@example.com");
    expect(getUserName(unnamed)).toBe("ada");
  });

  it("is undefined without a user", () => {
    expect(getUserName(null)).toBeUndefined();
  });
});

describe("getUserInitials", () => {
  it("uses the name's initials, upper-cased", () => {
    expect(getUserInitials(named)).toBe("AL");
  });

  it("falls back to the first two letters of the email", () => {
    expect(getUserInitials(unnamed)).toBe("AD");
  });

  it("is undefined without a user", () => {
    expect(getUserInitials()).toBeUndefined();
  });
});
