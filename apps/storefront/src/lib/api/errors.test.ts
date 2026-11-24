import { describe, expect, it } from "vitest";
import { errorMessageKey } from "./errors";

describe("errorMessageKey", () => {
  it("maps known codes", () => {
    expect(errorMessageKey("REQUIRED")).toBe("required");
    expect(errorMessageKey("INVALID")).toBe("invalid");
    expect(errorMessageKey("NOT_FOUND")).toBe("notFound");
  });
  it("falls back to generic", () => {
    expect(errorMessageKey("SOMETHING_NEW")).toBe("generic");
    expect(errorMessageKey(undefined)).toBe("generic");
    expect(errorMessageKey("toString")).toBe("generic");
  });
});
