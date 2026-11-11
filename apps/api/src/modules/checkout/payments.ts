import {
  addMoney,
  type CurrencyCode,
  type Money,
  multiplyMoney,
  parseDecimal,
} from "@commerce/contracts";
import type { Executor } from "@commerce/db";
import {
  coveredAmounts,
  createCheckoutTransaction,
  getTransactionsByCheckoutIds,
  type PaymentEventRow,
  type PaymentTransactionRow,
  type TransactionAction,
  type TransactionInitializeError,
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

export type CheckoutTransactionResult =
  | { ok: true; transaction: PaymentTransactionRow; event: PaymentEventRow }
  | { ok: false; errors: TransactionInitializeError[] };

const MESSAGES = {
  completed: "The checkout is already completed.",
  emptyKey: "Cannot be provided as an empty string.",
  invalidAmount: "Enter a valid amount.",
  positiveAmount: "The amount must be greater than zero.",
  covered: "The checkout is already fully covered by its transactions.",
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

/**
 * Saleor's transactionInitialize for a checkout: locks the checkout (so a completion can't run at
 * the same time), works out the amount from fresh totals, and has the payments module process it.
 * An unknown checkout throws CheckoutNotFoundError (lockCheckout).
 */
export async function initializeCheckoutTransaction(
  db: Executor,
  checkoutId: string,
  request: CheckoutTransactionRequest,
): Promise<CheckoutTransactionResult> {
  return db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    if (checkout.completedOrderId !== null) {
      return { ok: false, errors: [{ field: "id", code: "INVALID", message: MESSAGES.completed }] };
    }
    if (request.idempotencyKey === "") {
      return {
        ok: false,
        errors: [{ field: "idempotencyKey", code: "INVALID", message: MESSAGES.emptyKey }],
      };
    }

    const currency = checkout.currency as CurrencyCode;
    let amount: Money;
    if (request.amount === undefined || request.amount === null) {
      const totals = await calculateCheckoutTotals(tx, checkoutId);
      const transactions = await getTransactionsByCheckoutIds(tx, [checkoutId]);
      amount = uncoveredAmount(totals.total.gross, transactions);
      if (amount.amountMinor === 0) {
        return {
          ok: false,
          errors: [{ field: "amount", code: "INVALID", message: MESSAGES.covered }],
        };
      }
    } else {
      try {
        amount = parseDecimal(request.amount, currency);
      } catch {
        return {
          ok: false,
          errors: [{ field: "amount", code: "INVALID", message: MESSAGES.invalidAmount }],
        };
      }
      if (amount.amountMinor <= 0) {
        return {
          ok: false,
          errors: [{ field: "amount", code: "INVALID", message: MESSAGES.positiveAmount }],
        };
      }
    }

    return createCheckoutTransaction(tx, {
      checkoutId,
      currency,
      amount: amount.amountMinor,
      action: request.action ?? "CHARGE",
      gatewayId: request.gatewayId,
      gatewayData: request.gatewayData,
      idempotencyKey: request.idempotencyKey ?? crypto.randomUUID(),
    });
  });
}
