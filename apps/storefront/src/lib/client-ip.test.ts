import { describe, expect, it } from "vitest";
import { clientIpFrom } from "./client-ip";

const h = (value?: string) => new Headers(value === undefined ? {} : { "x-forwarded-for": value });

describe("clientIpFrom", () => {
  it("is null without trust, whatever the header says", () => {
    expect(clientIpFrom(h("203.0.113.9"), false)).toBeNull();
  });
  it("takes the only entry with trust", () => {
    expect(clientIpFrom(h("203.0.113.9"), true)).toBe("203.0.113.9");
  });
  it("takes the last of many entries, never a client-forged earlier one", () => {
    expect(clientIpFrom(h("1.1.1.1, 2.2.2.2 , 203.0.113.9"), true)).toBe("203.0.113.9");
  });
  it("is null when the last entry is not an IP, or the header is missing", () => {
    expect(clientIpFrom(h("203.0.113.9, nonsense"), true)).toBeNull();
    expect(clientIpFrom(h(""), true)).toBeNull();
    expect(clientIpFrom(h(), true)).toBeNull();
  });
  it("accepts IPv6", () => {
    expect(clientIpFrom(h("1.1.1.1, 2001:db8::1"), true)).toBe("2001:db8::1");
  });
});
