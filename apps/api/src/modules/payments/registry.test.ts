import { describe, expect, it } from "vitest";
import {
  createFakeGateway,
  createGatewayRegistry,
  DUMMY_GATEWAY_ID,
  dummyGateway,
  gatewayRegistryFromEnv,
  MANUAL_GATEWAY_ID,
  readPaymentGatewayNames,
} from "./index.ts";

// Which gateways may start payments, and which can still serve existing transactions (ADR-0016).
describe("gateway registry", () => {
  it("starts payments only through enabled gateways, but serves every known one", () => {
    const fake = createFakeGateway();
    const registry = createGatewayRegistry([fake]);
    expect(registry.forInitialize(fake.id)).toBe(fake);
    expect(registry.forInitialize(DUMMY_GATEWAY_ID)).toBeNull();
    // Orders paid earlier through the dummy or manual gateway can still be refunded.
    expect(registry.forTransaction(DUMMY_GATEWAY_ID)).toBe(dummyGateway);
    expect(registry.forTransaction(MANUAL_GATEWAY_ID)?.id).toBe(MANUAL_GATEWAY_ID);
    expect(registry.forTransaction("unknown")).toBeNull();
  });

  it("reads PAYMENT_GATEWAYS with safe defaults", () => {
    expect(readPaymentGatewayNames({})).toEqual(["dummy"]);
    expect(readPaymentGatewayNames({ NODE_ENV: "production" })).toEqual([]);
    expect(readPaymentGatewayNames({ PAYMENT_GATEWAYS: " dummy , dummy " })).toEqual(["dummy"]);
    expect(readPaymentGatewayNames({ PAYMENT_GATEWAYS: "" })).toEqual([]);
    expect(() =>
      readPaymentGatewayNames({ NODE_ENV: "production", PAYMENT_GATEWAYS: "dummy" }),
    ).toThrow(/must not enable "dummy" in production/);
  });

  it("builds this process's registry from the environment", () => {
    expect(gatewayRegistryFromEnv({}).forInitialize(DUMMY_GATEWAY_ID)).toBe(dummyGateway);
    expect(
      gatewayRegistryFromEnv({ NODE_ENV: "production" }).forInitialize(DUMMY_GATEWAY_ID),
    ).toBeNull();
  });
});
