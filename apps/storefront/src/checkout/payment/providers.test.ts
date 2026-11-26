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
    expect(
      findProvider("dummy", ["dummy"])?.allowsRedirect("https://pay.wire.mn/c/1", {
        wireCheckoutOrigin: "https://pay.wire.mn",
      }),
    ).toBe(false);
  });

  it("sends Wire the shop's return page and follows only Wire's own pages in production", () => {
    const wire = findProvider("wire", ["wire"]);
    expect(wire?.gatewayId).toBe("mn.wire.payment");
    expect(wire?.gatewayData(context)).toEqual({
      returnUrl: "https://dino-craft.lol/checkout/return",
    });
    const real = { wireCheckoutOrigin: "https://pay.wire.mn" };
    expect(wire?.allowsRedirect("https://pay.wire.mn/c/cs_1", real)).toBe(true);
    expect(wire?.allowsRedirect("http://pay.wire.mn/c/cs_1", real)).toBe(false);
    expect(wire?.allowsRedirect("https://pay.wire.mn.evil.example/c", real)).toBe(false);
    expect(wire?.allowsRedirect("https://evil.example/c", real)).toBe(false);
    expect(wire?.allowsRedirect("javascript:alert(1)", real)).toBe(false);
    // The e2e run's fake Wire, configured explicitly.
    const fake = { wireCheckoutOrigin: "http://localhost:4099" };
    expect(wire?.allowsRedirect("http://localhost:4099/c/cs_1", fake)).toBe(true);
    expect(wire?.allowsRedirect("https://pay.wire.mn/c/cs_1", fake)).toBe(false);
  });
});
