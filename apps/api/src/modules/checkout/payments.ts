import {
  addMoney,
  type CurrencyCode,
  type Money,
  multiplyMoney,
  parseDecimal,
} from "@commerce/contracts";
import type { Executor } from "@commerce/db";
import { readAllowedClientHosts, validateRedirectUrl } from "../identity/index.ts";
import {
  cancelOpenAttempts,
  coveredAmounts,
  type GatewayRegistry,
  getTransactionsByCheckoutIds,
  initializeReplay,
  type PaymentTransactionRow,
  processInitializeRequest,
  recordInitializeRequest,
  type TransactionAction,
  type TransactionInitializeResult,
} from "../payments/index.ts";
import { lockCheckout } from "./checkouts.ts";
import { calculateCheckoutTotals } from "./totals.ts";

// Paying for a checkout (M5.3): Saleor's transactionInitialize and the checkout's payment statuses
// (saleor/graphql/payment/mutations/transaction/transaction_initialize.py,
// saleor/checkout/payment_utils.py). The checkout module composes it — it locks the checkout and
// computes the totals — and the payments module writes the transaction (ARCHITECTURE §2 rule 5:
// checkout → payments). Statuses are computed live, like the totals, never stored.

export type CheckoutAuthorizeStatus = "NONE" | "PARTIAL" | "FULL";
export type CheckoutChargeStatus = "NONE" | "PARTIAL" | "FULL" | "OVERCHARGED";

export type CheckoutTransactionRequest = {
  /** A decimal amount in the checkout currency; omitted means "what is still uncovered". */
  amount?: string | null;
  /** Saleor's TransactionFlowStrategyEnum; omitted means CHARGE (Saleor's channel default). */
  action?: TransactionAction | null;
  gatewayId: string;
  gatewayData?: unknown;
  /** Omitted means a new random key, as Saleor. An empty string is INVALID. */
  idempotencyKey?: string | null;
};

export type CheckoutTransactionResult = TransactionInitializeResult;

const MESSAGES = {
  completed: "The checkout is already completed.",
  emptyKey: "Cannot be provided as an empty string.",
  invalidAmount: "Enter a valid amount.",
  positiveAmount: "The amount must be greater than zero.",
  covered: "The checkout is already fully covered by its transactions.",
  gatewayNotFound: "App with provided identifier not found.",
};

const subtract = (a: Money, b: Money): Money => addMoney(a, multiplyMoney(b, -1));

/**
 * Saleor's `get_amount`: the checkout total minus, per transaction, the larger of its authorized
 * and charged amounts; never below zero.
 */
export function uncoveredAmount(
  total: Money,
  transactions: readonly PaymentTransactionRow[],
): Money {
  let amount = total;
  for (const transaction of transactions) {
    const covered = Math.max(transaction.authorizedAmount, transaction.chargedAmount);
    amount = subtract(amount, {
      amountMinor: covered,
      currency: transaction.currency as CurrencyCode,
    });
  }
  return amount.amountMinor < 0 ? { amountMinor: 0, currency: total.currency } : amount;
}

/** Saleor's `_update_authorize_status` and `_update_charge_status`, computed on demand. */
export function checkoutPaymentStatuses(
  total: Money,
  hasLines: boolean,
  transactions: readonly PaymentTransactionRow[],
): {
  authorizeStatus: CheckoutAuthorizeStatus;
  chargeStatus: CheckoutChargeStatus;
  totalBalance: Money;
} {
  const { authorized, charged } = coveredAmounts(transactions, total.currency);
  const covered = addMoney(authorized, charged).amountMinor;
  const onlyZeroPriceLines = hasLines && total.amountMinor <= 0;

  let authorizeStatus: CheckoutAuthorizeStatus;
  if (onlyZeroPriceLines) authorizeStatus = "FULL";
  else if (covered === 0) authorizeStatus = "NONE";
  else if (covered >= total.amountMinor) authorizeStatus = "FULL";
  else authorizeStatus = "PARTIAL";

  let chargeStatus: CheckoutChargeStatus;
  if (charged.amountMinor <= 0) chargeStatus = onlyZeroPriceLines ? "FULL" : "NONE";
  else if (charged.amountMinor < total.amountMinor) chargeStatus = "PARTIAL";
  else if (charged.amountMinor === total.amountMinor) chargeStatus = "FULL";
  else chargeStatus = "OVERCHARGED";

  // Saleor's Checkout.totalBalance: the charged amount minus the total.
  return { authorizeStatus, chargeStatus, totalBalance: subtract(charged, total) };
}

/** `gatewayData.returnUrl`: where a redirect gateway sends the shopper back, if given. */
function returnUrlOf(gatewayData: unknown): unknown {
  return gatewayData && typeof gatewayData === "object"
    ? (gatewayData as { returnUrl?: unknown }).returnUrl
    : undefined;
}

/**
 * Saleor's transactionInitialize for a checkout (ADR-0016 §2). Before anything is recorded: the
 * gateway must be enabled and accept the data, and a `returnUrl` must be on an allowed client
 * host (Saleor's ALLOWED_CLIENT_HOSTS). Then the checkout's older unpaid attempts are canceled at
 * their gateway (no paying twice), the checkout is locked while the amount is worked out from fresh
 * totals and the request is recorded, and the gateway is called after the lock is released. A
 * retry with the same idempotency key returns the first answer, or finishes a request whose
 * answer was never recorded. An unknown checkout throws CheckoutNotFoundError (lockCheckout).
 */
export async function initializeCheckoutTransaction(
  db: Executor,
  gateways: GatewayRegistry,
  checkoutId: string,
  request: CheckoutTransactionRequest,
): Promise<CheckoutTransactionResult> {
  const gateway = gateways.forInitialize(request.gatewayId);
  if (!gateway) {
    return {
      ok: false,
      errors: [{ field: "paymentGateway", code: "NOT_FOUND", message: MESSAGES.gatewayNotFound }],
    };
  }
  if (request.idempotencyKey === "") {
    return {
      ok: false,
      errors: [{ field: "idempotencyKey", code: "INVALID", message: MESSAGES.emptyKey }],
    };
  }
  const action = request.action ?? "CHARGE";
  const invalidData = gateway.validate?.(action, request.gatewayData) ?? null;
  if (invalidData !== null) {
    return {
      ok: false,
      errors: [{ field: "paymentGateway", code: "INVALID", message: invalidData }],
    };
  }
  const returnUrl = returnUrlOf(request.gatewayData);
  if (returnUrl !== undefined && returnUrl !== null) {
    const problem =
      typeof returnUrl === "string"
        ? validateRedirectUrl(returnUrl, readAllowedClientHosts())
        : "The return URL must be a string.";
    if (problem !== null) {
      return {
        ok: false,
        errors: [{ field: "paymentGateway", code: "INVALID", message: problem }],
      };
    }
  }
  const idempotencyKey = request.idempotencyKey ?? crypto.randomUUID();

  await cancelOpenAttempts(db, gateways, checkoutId, idempotencyKey);

  const recorded = await db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    if (checkout.completedOrderId !== null) {
      return {
        ok: false as const,
        errors: [{ field: "id", code: "INVALID" as const, message: MESSAGES.completed }],
      };
    }

    const currency = checkout.currency as CurrencyCode;
    let amount: Money;
    if (request.amount === undefined || request.amount === null) {
      const totals = await calculateCheckoutTotals(tx, checkoutId);
      const transactions = await getTransactionsByCheckoutIds(tx, [checkoutId]);
      // A retry of this very request must not see its own pending amount as "covered".
      amount = uncoveredAmount(
        totals.total.gross,
        transactions.filter((transaction) => transaction.idempotencyKey !== idempotencyKey),
      );
      if (amount.amountMinor === 0) {
        return {
          ok: false as const,
          errors: [{ field: "amount", code: "INVALID" as const, message: MESSAGES.covered }],
        };
      }
    } else {
      try {
        amount = parseDecimal(request.amount, currency);
      } catch {
        return {
          ok: false as const,
          errors: [{ field: "amount", code: "INVALID" as const, message: MESSAGES.invalidAmount }],
        };
      }
      if (amount.amountMinor <= 0) {
        return {
          ok: false as const,
          errors: [{ field: "amount", code: "INVALID" as const, message: MESSAGES.positiveAmount }],
        };
      }
    }

    return recordInitializeRequest(tx, {
      checkoutId,
      currency,
      amount: amount.amountMinor,
      action,
      gateway,
      idempotencyKey,
    });
  });
  if (!recorded.ok) return recorded;
  if (recorded.outcome) return initializeReplay(recorded.transaction, recorded.outcome);
  return processInitializeRequest(db, gateway, recorded.transaction, recorded.request, {
    gatewayData: request.gatewayData,
    returnUrl: typeof returnUrl === "string" ? returnUrl : null,
  });
}
