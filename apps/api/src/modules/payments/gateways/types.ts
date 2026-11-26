// The payment gateway adapter (ADR-0016 §1): everything the payments module needs from a payment
// provider, and nothing about our database. One implementation per provider (the built-in dummy
// and manual gateways, Wire, later QPay direct); the registry picks one by Saleor's `gatewayId`.
// Gateways are called outside database transactions: the payments module records the request
// first, calls the gateway with an idempotency key derived from that record, then records the
// result (so a crash at any point can be retried without paying twice).

/** Saleor's TransactionFlowStrategyEnum. */
export type TransactionAction = "AUTHORIZATION" | "CHARGE";

export type InitializeInput = {
  /** Our transaction id: also the idempotency key at the gateway and its reference to us. */
  transactionId: string;
  /** Minor units, > 0. */
  amount: number;
  currency: string;
  action: TransactionAction;
  /** Saleor's `paymentGateway.data` as sent by the client. */
  gatewayData: unknown;
  /** Where the gateway sends the shopper back (validated by the caller), or null. */
  returnUrl: string | null;
};

export type InitializeResult =
  /** Paid (or authorized) at once. */
  | { kind: "success"; pspReference: string; chargeReference?: string }
  /** Declined at once; nothing was taken. */
  | { kind: "failure"; message: string; pspReference?: string }
  /** The shopper has to act (pay in a bank app on the gateway's page); the result comes later. */
  | { kind: "action_required"; pspReference: string; url: string; expiresAt: Date };

/** A payment's state at the gateway, read again whenever we learn something changed. */
export type GatewayPaymentStatus = {
  status: "action_required" | "pending" | "succeeded" | "failed" | "canceled";
  /** What the gateway says was paid (minor units); compared with what we asked for. */
  amount: number;
  /** The charge to refund later, when the gateway distinguishes it from the payment. */
  chargeReference: string | null;
  /** The gateway's reason for a failure or cancellation, for staff. */
  message: string;
};

export type RefundInput = {
  /** The payment's reference (`pspReference`) and, when known, its charge's. */
  pspReference: string;
  chargeReference: string | null;
  amount: number;
  currency: string;
  /** Our REFUND_REQUEST event id: a retry with it never refunds twice. */
  idempotencyKey: string;
  reason: string;
};

export type RefundResult = {
  /**
   * `manual_required`: the gateway can't refund through its API; its operations team completes it
   * (Wire, ADR-0016 §8). The amount stays reserved until a later status settles it.
   */
  status: "succeeded" | "pending" | "manual_required" | "failed";
  refundReference: string;
  message: string;
};

export interface PaymentGateway {
  /** Saleor's gateway (app) identifier, e.g. `saleor.io.dummy-payment-app`. */
  readonly id: string;
  /** Saleor's TransactionItem.name for the transactions it creates, shown to staff. */
  readonly name: string;
  /**
   * The shopper pays later, on the gateway's page (Wire). Such a payment is only started for a
   * checkout that can become an order (ADR-0016 §7); one that settles at once (the dummy gateway)
   * keeps Saleor's rule that any checkout may be paid.
   */
  readonly settlesLater?: boolean;
  /**
   * Checks `gatewayData` before anything is recorded; a message rejects the request with
   * Saleor's INVALID error. Optional: most gateways accept any data.
   */
  validate?(action: TransactionAction, gatewayData: unknown): string | null;
  initialize(input: InitializeInput): Promise<InitializeResult>;
  fetchStatus(pspReference: string): Promise<GatewayPaymentStatus>;
  refund(input: RefundInput): Promise<RefundResult>;
  /**
   * A refund's current state, for refunds left `pending` or `manual_required`. Optional: a gateway
   * that settles refunds at once doesn't need it.
   */
  fetchRefund?(refundReference: string): Promise<RefundResult>;
  /**
   * Cancels an unpaid payment so the shopper can't pay it any more. Resolves when canceled or
   * when there was nothing to cancel; the caller reads `fetchStatus` afterwards for the truth
   * (it may have been paid in the meantime).
   */
  cancel(pspReference: string): Promise<void>;
}

/**
 * The gateway couldn't be reached or failed on its side (network, timeout, 5xx). Nothing is known
 * about the outcome: the request stays recorded and is retried with the same idempotency key.
 */
export class GatewayUnavailableError extends Error {
  readonly gatewayId: string;

  constructor(gatewayId: string, message: string, options?: { cause?: unknown }) {
    super(`${gatewayId}: ${message}`, options);
    this.name = "GatewayUnavailableError";
    this.gatewayId = gatewayId;
  }
}
