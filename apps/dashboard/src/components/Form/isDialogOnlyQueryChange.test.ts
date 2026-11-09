import { describe, expect, it } from "vitest";

import { isDialogOnlyQueryChange } from "./isDialogOnlyQueryChange";

describe("isDialogOnlyQueryChange", () => {
  it("is true when only the dialog params change", () => {
    expect(isDialogOnlyQueryChange("", "?action=create")).toBe(true);
    expect(isDialogOnlyQueryChange("?action=delete", "")).toBe(true);
    expect(isDialogOnlyQueryChange("?query=x&action=create", "?query=x")).toBe(true);
  });

  it("is false when other params change too, or nothing changes", () => {
    expect(isDialogOnlyQueryChange("?query=x", "?query=y&action=create")).toBe(false);
    expect(isDialogOnlyQueryChange("?query=x", "?query=y")).toBe(false);
    expect(isDialogOnlyQueryChange("?action=create", "?action=create")).toBe(false);
  });

  it("ignores parameter order", () => {
    expect(isDialogOnlyQueryChange("?a=1&b=2", "?b=2&a=1&action=delete")).toBe(true);
  });
});
