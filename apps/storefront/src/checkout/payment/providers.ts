import type { ComponentType } from "react";
import { DummyPayment } from "./dummy";
import { WirePayment } from "./wire";

// The payment provider registry (ARCHITECTURE §10.9). A provider is the gateway the API knows by
// `gatewayId`, a label key, the UI shown on the payment step, and the gateway data the SERVER
// builds for `transactionInitialize` (the browser never chooses it). `PAYMENT_PROVIDERS` decides
// which entries are on. A provider that settles later (Wire, ADR-0016) answers with a page the
// shopper is sent to; `allowsRedirect` says which pages are its own.

export type ProviderId = "dummy" | "wire";

/** What the server knows when it builds a provider's gateway data. */
export type GatewayDataContext = { storefrontUrl: string };

/** Where providers' payment pages may be (configuration, `getEnv()`). */
export type RedirectContext = { wireCheckoutOrigin: string };

export type PaymentProvider = {
  id: ProviderId;
  /** The API's identifier of the payment gateway. */
  gatewayId: string;
  /** Key of the `checkout.payment.providers` message namespace. */
  labelKey: ProviderId;
  Component: ComponentType;
  /** The `paymentGateway.data` of `transactionInitialize`, built on the server. */
  gatewayData: (context: GatewayDataContext) => unknown;
  /**
   * Whether the shopper may be sent to `url` (the gateway's payment page from the API's `data`):
   * only the provider's own payment page origin (WIRE_CHECKOUT_ORIGIN; the e2e run's fake Wire).
   */
  allowsRedirect: (url: string, context: RedirectContext) => boolean;
};

const httpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

/** Wire's hosted payment page: exactly the configured origin (https://pay.wire.mn by default). */
function isWirePage(value: string, { wireCheckoutOrigin }: RedirectContext): boolean {
  return httpUrl(value)?.origin === wireCheckoutOrigin;
}

const REGISTRY: readonly PaymentProvider[] = [
  {
    id: "dummy",
    gatewayId: "saleor.io.dummy-payment-app",
    labelKey: "dummy",
    Component: DummyPayment,
    // The dummy gateway succeeds when asked to (`data.event.type`, apps/api payments).
    gatewayData: () => ({ event: { type: "CHARGE_SUCCESS" } }),
    // It never sends the shopper anywhere.
    allowsRedirect: () => false,
  },
  {
    id: "wire",
    gatewayId: "mn.wire.payment",
    labelKey: "wire",
    Component: WirePayment,
    // Wire sends the shopper back here after paying (or giving up); the page settles the order.
    gatewayData: ({ storefrontUrl }) => ({ returnUrl: `${storefrontUrl}/checkout/return` }),
    allowsRedirect: isWirePage,
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
