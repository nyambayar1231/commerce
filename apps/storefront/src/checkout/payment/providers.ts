import type { ComponentType } from "react";
import { DummyPayment } from "./dummy";

// The payment provider registry (ARCHITECTURE §10.9). A provider is the gateway the API knows by
// `gatewayId`, a label key, the UI shown on the payment step, and the gateway data the SERVER
// builds for `transactionInitialize` (the browser never chooses it). `PAYMENT_PROVIDERS` decides
// which entries are on. Real gateways later add entries here.

export type ProviderId = "dummy";

export type PaymentProvider = {
  id: ProviderId;
  /** The API's identifier of the payment gateway. */
  gatewayId: string;
  /** Key of the `checkout.payment.providers` message namespace. */
  labelKey: ProviderId;
  Component: ComponentType;
  /** The `paymentGateway.data` of `transactionInitialize`, built on the server. */
  gatewayData: () => unknown;
};

const REGISTRY: readonly PaymentProvider[] = [
  {
    id: "dummy",
    gatewayId: "saleor.io.dummy-payment-app",
    labelKey: "dummy",
    Component: DummyPayment,
    // The dummy gateway succeeds when asked to (`data.event.type`, apps/api payments).
    gatewayData: () => ({ event: { type: "CHARGE_SUCCESS" } }),
  },
];

/** The registered providers whose id is in `enabled` (the `PAYMENT_PROVIDERS` list), in order. */
export function enabledProviders(enabled: readonly string[]): PaymentProvider[] {
  return REGISTRY.filter((provider) => enabled.includes(provider.id));
}

/** The provider with this id when it is enabled, else null (never trusts the browser's value). */
export function findProvider(id: unknown, enabled: readonly string[]): PaymentProvider | null {
  if (typeof id !== "string") return null;
  return enabledProviders(enabled).find((provider) => provider.id === id) ?? null;
}
