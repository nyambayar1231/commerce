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

  it("builds the dummy gateway's data on the server: a successful charge", () => {
    expect(findProvider("dummy", ["dummy"])?.gatewayData()).toEqual({
      event: { type: "CHARGE_SUCCESS" },
    });
  });
});
