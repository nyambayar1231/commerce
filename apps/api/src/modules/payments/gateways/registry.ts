import { dummyGateway, manualGateway } from "./builtIn.ts";
import type { PaymentGateway } from "./types.ts";
import { createWireGateway, readWireConfig } from "./wire.ts";

// Which gateways this process uses (ADR-0016 §1). Built once at start (server.ts, worker.ts) from
// `PAYMENT_GATEWAYS` and passed to every domain function that talks to a gateway — never read
// from a module-level singleton, so tests choose their gateways and production can't fall back
// to the dummy one by accident.

type Env = Record<string, string | undefined>;

export interface GatewayRegistry {
  /** A gateway that may start new payments (`PAYMENT_GATEWAYS`), or null. */
  forInitialize(gatewayId: string): PaymentGateway | null;
  /**
   * The gateway that processed an existing transaction (refunds, status reads), whether or not it
   * may start new payments: an order paid through a gateway that was since switched off can still
   * be refunded. Null for a provider this process doesn't know.
   */
  forTransaction(provider: string): PaymentGateway | null;
}

/**
 * A registry where `enabled` gateways may start payments and every known gateway (`enabled`, the
 * built-in dummy and manual ones, and `known`) can serve existing transactions.
 */
export function createGatewayRegistry(
  enabled: readonly PaymentGateway[],
  known: readonly PaymentGateway[] = [],
): GatewayRegistry {
  const initializable = new Map(enabled.map((gateway) => [gateway.id, gateway]));
  const all = new Map(
    [dummyGateway, manualGateway, ...known, ...enabled].map((gateway) => [gateway.id, gateway]),
  );
  return {
    forInitialize: (gatewayId) => initializable.get(gatewayId) ?? null,
    forTransaction: (provider) => all.get(provider) ?? null,
  };
}

/** The names `PAYMENT_GATEWAYS` accepts. */
export const PAYMENT_GATEWAY_NAMES = ["dummy", "wire"] as const;
export type PaymentGatewayName = (typeof PAYMENT_GATEWAY_NAMES)[number];

/**
 * `PAYMENT_GATEWAYS` (comma-separated names): the gateways that may start payments. Default:
 * `dummy` in development and tests; nothing in production, where `dummy` also needs
 * `ALLOW_DUMMY_GATEWAY=true` (fake payments must never be taken by accident). Throws with every
 * problem in the message.
 */
export function readPaymentGatewayNames(env: Env = process.env): PaymentGatewayName[] {
  const production = env.NODE_ENV === "production";
  const raw = env.PAYMENT_GATEWAYS ?? (production ? "" : "dummy");
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  const unknown = names.filter(
    (name) => !(PAYMENT_GATEWAY_NAMES as readonly string[]).includes(name),
  );
  if (unknown.length > 0) {
    throw new Error(
      `PAYMENT_GATEWAYS: unknown gateway ${unknown.map((n) => `"${n}"`).join(", ")} ` +
        `(allowed: ${PAYMENT_GATEWAY_NAMES.join(", ")})`,
    );
  }
  if (production && names.includes("dummy") && env.ALLOW_DUMMY_GATEWAY !== "true") {
    throw new Error(
      'PAYMENT_GATEWAYS must not enable "dummy" in production (it marks orders as paid without ' +
        "taking money); set ALLOW_DUMMY_GATEWAY=true only for a demo",
    );
  }
  const unique = [...new Set(names)] as PaymentGatewayName[];
  // A gateway's own settings are checked with it, so a deployment fails at start, not at payment.
  if (unique.includes("wire")) readWireConfig(env);
  return unique;
}

/**
 * The registry for this process, from `PAYMENT_GATEWAYS`. Wire stays known for refunds and status
 * reads while its key is configured, even when it no longer starts payments (switched off for a
 * successor such as QPay direct, M16.6).
 */
export function gatewayRegistryFromEnv(env: Env = process.env): GatewayRegistry {
  const names = readPaymentGatewayNames(env);
  const wire =
    names.includes("wire") || env.WIRE_API_KEY ? createWireGateway(readWireConfig(env)) : null;
  const enabled = names.map((name) => (name === "wire" ? wire : dummyGateway));
  return createGatewayRegistry(
    enabled.filter((gateway): gateway is PaymentGateway => gateway !== null),
    wire && !names.includes("wire") ? [wire] : [],
  );
}
