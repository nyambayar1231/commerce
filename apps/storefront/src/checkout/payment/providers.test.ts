import { describe, expect, it } from "vitest";
import { enabledProviders, findProvider } from "./providers";

describe("provider registry", () => {
  it("lists the registered providers named in PAYMENT_PROVIDERS", () => {
    expect(enabledProviders(["dummy"]).map((provider) => provider.id)).toEqual(["dummy"]);
  });

  it("lists none when none is enabled, and ignores names it does not know", () => {
    expect(enabledProviders([])).toEqual([]);
    expect(enabledProviders(["stripe"])).toEqual([]);
  });

  it("finds an enabled provider by id and nothing else", () => {
    expect(findProvider("dummy", ["dummy"])?.gatewayId).toBe("saleor.io.dummy-payment-app");
    expect(findProvider("dummy", [])).toBeNull();
    expect(findProvider("stripe", ["dummy"])).toBeNull();
    expect(findProvider(undefined, ["dummy"])).toBeNull();
    expect(findProvider({ id: "dummy" }, ["dummy"])).toBeNull();
  });

  const context = { storefrontUrl: "https://dino-craft.lol" };

  it("builds the dummy gateway's data on the server: a successful charge", () => {
    expect(findProvider("dummy", ["dummy"])?.gatewayData(context)).toEqual({
      event: { type: "CHARGE_SUCCESS" },
    });
    expect(findProvider("dummy", ["dummy"])?.allowsRedirect("https://pay.wire.mn/c/1", false)).toBe(
      false,
    );
  });

  it("sends Wire the shop's return page and follows only Wire's own pages in production", () => {
    const wire = findProvider("wire", ["wire"]);
    expect(wire?.gatewayId).toBe("mn.wire.payment");
    expect(wire?.gatewayData(context)).toEqual({
      returnUrl: "https://dino-craft.lol/checkout/return",
    });
    expect(wire?.allowsRedirect("https://pay.wire.mn/c/cs_1", true)).toBe(true);
    expect(wire?.allowsRedirect("http://pay.wire.mn/c/cs_1", true)).toBe(false);
    expect(wire?.allowsRedirect("https://pay.wire.mn.evil.example/c", true)).toBe(false);
    expect(wire?.allowsRedirect("https://evil.example/c", true)).toBe(false);
    expect(wire?.allowsRedirect("javascript:alert(1)", false)).toBe(false);
    // Development and e2e use a fake Wire on localhost.
    expect(wire?.allowsRedirect("http://localhost:4099/c/cs_1", false)).toBe(true);
  });
});
