import {
  createGatewayRegistry,
  dummyGateway,
  type GatewayRegistry,
  type PaymentGateway,
} from "../src/modules/payments/index.ts";

/**
 * The gateways tests use: the dummy gateway may start payments (as in development), plus any
 * `extra` gateways (e.g. the fake redirect gateway, M16).
 */
export function testGateways(...extra: PaymentGateway[]): GatewayRegistry {
  return createGatewayRegistry([dummyGateway, ...extra]);
}
