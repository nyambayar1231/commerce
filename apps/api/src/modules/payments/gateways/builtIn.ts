import type { PaymentGateway, TransactionAction } from "./types.ts";

// The two gateways that need no provider: Saleor's dummy payment app (development, tests and the
// e2e golden paths; never in production unless allowed, config.ts) and the manual gateway behind
// orderMarkAsPaid, whose money moved outside the shop (cash, bank transfer). Both answer at once.

/** Saleor's dummy payment app identifier. */
export const DUMMY_GATEWAY_ID = "saleor.io.dummy-payment-app";

/** Saleor's MARK_AS_PAID transactions are processed by no gateway; ours is called "manual". */
export const MANUAL_GATEWAY_ID = "manual";

const RESULT_TYPES: Record<TransactionAction, readonly string[]> = {
  AUTHORIZATION: ["AUTHORIZATION_SUCCESS", "AUTHORIZATION_FAILURE"],
  CHARGE: ["CHARGE_SUCCESS", "CHARGE_FAILURE"],
};

/** The dummy app's `data.event.type`, or undefined when not given. */
function requestedEventType(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") return undefined;
  const event = (data as { event?: unknown }).event;
  return event && typeof event === "object" ? (event as { type?: unknown }).type : undefined;
}

/**
 * Saleor's dummy payment app: succeeds by default; `data.event.type` picks the outcome (e.g.
 * `CHARGE_FAILURE`) so failures can be tried. The type must belong to the action.
 */
export const dummyGateway: PaymentGateway = {
  id: DUMMY_GATEWAY_ID,
  name: "Dummy payment",
  validate(action, gatewayData) {
    const type = requestedEventType(gatewayData);
    if (type === undefined) return null;
    const allowed = RESULT_TYPES[action];
    if (typeof type === "string" && allowed.includes(type)) return null;
    return `The dummy gateway's event type must be one of: ${allowed.join(", ")}.`;
  },
  async initialize({ gatewayData }) {
    const type = requestedEventType(gatewayData);
    if (typeof type === "string" && type.endsWith("_FAILURE")) {
      return { kind: "failure", message: "The dummy gateway declined the payment." };
    }
    return { kind: "success", pspReference: `dummy-${crypto.randomUUID()}` };
  },
  async fetchStatus() {
    // The dummy gateway settles every payment in `initialize`; nothing is ever left to read.
    throw new Error("The dummy gateway has no payment to read: it settles at once.");
  },
  async refund() {
    return {
      status: "succeeded",
      refundReference: `dummy-refund-${crypto.randomUUID()}`,
      message: "",
    };
  },
  async cancel() {},
};

/** Refunds of manually paid orders: the staff returned the money themselves; we record it. */
export const manualGateway: PaymentGateway = {
  id: MANUAL_GATEWAY_ID,
  name: "Mark-as-paid transaction",
  async initialize() {
    throw new Error("Manual transactions are created by orderMarkAsPaid, not initialized.");
  },
  async fetchStatus() {
    throw new Error("Manual transactions have no gateway status.");
  },
  async refund() {
    return {
      status: "succeeded",
      refundReference: `manual-refund-${crypto.randomUUID()}`,
      message: "",
    };
  },
  async cancel() {},
};
