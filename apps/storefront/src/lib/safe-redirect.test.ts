import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps a relative path and its query", () => {
    expect(safeNextPath("/account/orders", "/")).toBe("/account/orders");
    expect(safeNextPath("/products/a-b?page=2&sort=price", "/")).toBe(
      "/products/a-b?page=2&sort=price",
    );
    expect(safeNextPath("/checkout?step=shipping", "/")).toBe("/checkout?step=shipping");
  });
  it.each([
    ["//evil.example", "protocol-relative"],
    ["/\\evil.example", "backslash"],
    ["/a\\b", "backslash inside"],
    ["https://evil.example", "absolute URL"],
    ["javascript:alert(1)", "javascript scheme"],
    ["/%2F%2Fevil.example", "encoded slashes"],
    ["/%2fevil", "encoded slash, lower case"],
    ["/%5Cevil", "encoded backslash"],
    ["/a//b", "double slash inside"],
    ["/a\nb", "newline"],
    ["/a\tb", "tab"],
    ["/a\u0000b", "NUL"],
    ["evil", "no leading slash"],
    ["", "empty"],
  ])("falls back for %s (%s)", (value) => {
    expect(safeNextPath(value, "/fallback")).toBe("/fallback");
  });
  it("falls back for the sign-in and sign-up pages (a redirect loop)", () => {
    expect(safeNextPath("/login", "/")).toBe("/");
    expect(safeNextPath("/login?next=/x", "/")).toBe("/");
    expect(safeNextPath("/login/", "/")).toBe("/");
    expect(safeNextPath("/signup", "/")).toBe("/");
    expect(safeNextPath("/loginx", "/")).toBe("/loginx");
  });
  it("falls back for anything that is not a string", () => {
    for (const value of [undefined, null, 42, ["/a"], {}]) {
      expect(safeNextPath(value, "/fallback")).toBe("/fallback");
    }
  });
});
