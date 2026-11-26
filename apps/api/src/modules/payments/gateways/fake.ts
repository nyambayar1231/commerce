import type {
  GatewayPaymentStatus,
  InitializeInput,
  InitializeResult,
  PaymentGateway,
  RefundInput,
  RefundResult,
} from "./types.ts";
import { GatewayUnavailableError } from "./types.ts";

// A redirect gateway for tests (ADR-0016 §10): it behaves like Wire — `initialize` asks the shopper
// to act, the outcome is read later — and each test scripts its answers. Never registered from
// configuration; tests pass it to `createGatewayRegistry`. It keeps idempotency like a real
// gateway: the same transaction id or refund key returns the first answer.

export const FAKE_GATEWAY_ID = "test.fake-redirect";

export type FakeGateway = PaymentGateway & {
  /** Every call, in order, for assertions. */
  readonly calls: { method: string; input: unknown }[];
  /** The payment's next status (`fetchStatus`), by pspReference. */
  setStatus(pspReference: string, status: Partial<GatewayPaymentStatus>): void;
  /** The next initialize answer; default: action required. */
  nextInitialize: ((input: InitializeInput) => InitializeResult) | null;
  /** The next refund answer; default: succeeded. */
  nextRefund: ((input: RefundInput) => RefundResult) | null;
  /** Makes the next call to `method` fail as unreachable. */
  failNext(method: "initialize" | "fetchStatus" | "refund" | "fetchRefund" | "cancel"): void;
  /** A refund's later state (`fetchRefund`), by refund reference. */
  setRefund(refundReference: string, result: Partial<RefundResult>): void;
};

export function createFakeGateway(): FakeGateway {
  const calls: { method: string; input: unknown }[] = [];
  const payments = new Map<string, { amount: number; status: GatewayPaymentStatus }>();
  const byTransaction = new Map<string, InitializeResult>();
  const refunds = new Map<string, RefundResult>();
  const failing = new Set<string>();

  const unreachable = (method: string) => {
    if (!failing.has(method)) return;
    failing.delete(method);
    throw new GatewayUnavailableError(FAKE_GATEWAY_ID, `${method} timed out`);
  };

  const gateway: FakeGateway = {
    id: FAKE_GATEWAY_ID,
    name: "Fake redirect gateway",
    settlesLater: true,
    calls,
    nextInitialize: null,
    nextRefund: null,
    setStatus(pspReference, status) {
      const payment = payments.get(pspReference);
      if (!payment) throw new Error(`fake gateway: no payment ${pspReference}`);
      payment.status = { ...payment.status, ...status };
    },
    failNext(method) {
      failing.add(method);
    },
    setRefund(refundReference, result) {
      for (const [key, refund] of refunds) {
        if (refund.refundReference === refundReference) refunds.set(key, { ...refund, ...result });
      }
    },
    async fetchRefund(refundReference) {
      calls.push({ method: "fetchRefund", input: refundReference });
      unreachable("fetchRefund");
      for (const refund of refunds.values()) {
        if (refund.refundReference === refundReference) return refund;
      }
      throw new Error(`fake gateway: no refund ${refundReference}`);
    },
    async initialize(input) {
      calls.push({ method: "initialize", input });
      unreachable("initialize");
      const previous = byTransaction.get(input.transactionId);
      if (previous) return previous;
      const result: InitializeResult = gateway.nextInitialize
        ? gateway.nextInitialize(input)
        : {
            kind: "action_required",
            pspReference: `pi_${crypto.randomUUID()}`,
            url: `https://pay.example.test/${input.transactionId}`,
            expiresAt: new Date(Date.now() + 15 * 60_000),
          };
      gateway.nextInitialize = null;
      byTransaction.set(input.transactionId, result);
      if (result.kind !== "failure" || result.pspReference) {
        const pspReference = result.pspReference ?? "";
        payments.set(pspReference, {
          amount: input.amount,
          status: {
            status: result.kind === "success" ? "succeeded" : "action_required",
            amount: input.amount,
            chargeReference: result.kind === "success" ? `ch_${pspReference}` : null,
            message: "",
          },
        });
      }
      return result;
    },
    async fetchStatus(pspReference) {
      calls.push({ method: "fetchStatus", input: pspReference });
      unreachable("fetchStatus");
      const payment = payments.get(pspReference);
      if (!payment) throw new Error(`fake gateway: no payment ${pspReference}`);
      return payment.status;
    },
    async refund(input) {
      calls.push({ method: "refund", input });
      unreachable("refund");
      const previous = refunds.get(input.idempotencyKey);
      if (previous) return previous;
      const result: RefundResult = gateway.nextRefund
        ? gateway.nextRefund(input)
        : { status: "succeeded", refundReference: `re_${crypto.randomUUID()}`, message: "" };
      gateway.nextRefund = null;
      refunds.set(input.idempotencyKey, result);
      return result;
    },
    async cancel(pspReference) {
      calls.push({ method: "cancel", input: pspReference });
      unreachable("cancel");
      const payment = payments.get(pspReference);
      if (payment && payment.status.status === "action_required") {
        payment.status = { ...payment.status, status: "canceled", message: "Canceled" };
      }
    },
  };
  return gateway;
}
