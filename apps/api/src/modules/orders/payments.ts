import { addMoney, type CurrencyCode, type Money, multiplyMoney } from "@commerce/contracts";
import type { PaymentTransactionRow } from "../payments/index.ts";

// An order's payment status (PLAN M6 decision 6): Saleor's update_order_charge_status and
// update_order_authorize_status (saleor/order/utils.py) without granted refunds, computed from the
// order's transactions on read — never stored (ARCHITECTURE §3 "Orders").
//
// Saleor lowers a transaction's charged value when it is refunded; we keep the gross charge and
// the refunds in separate columns (`refunded ≤ charged` is a DB CHECK), so the charged total here
// is Saleor's: charged − refunded.

export type OrderChargeStatus = "NONE" | "PARTIAL" | "FULL" | "OVERCHARGED";
export type OrderAuthorizeStatus = "NONE" | "PARTIAL" | "FULL";

export type OrderPaymentSummary = {
  chargeStatus: OrderChargeStatus;
  authorizeStatus: OrderAuthorizeStatus;
  totalCharged: Money;
  totalAuthorized: Money;
  totalRefunded: Money;
  /** Saleor's Order.totalBalance: charged minus the order total. */
  totalBalance: Money;
};

export function orderPaymentSummary(
  total: Money,
  transactions: readonly PaymentTransactionRow[],
): OrderPaymentSummary {
  const zero: Money = { amountMinor: 0, currency: total.currency };
  let charged = zero;
  let authorized = zero;
  let refunded = zero;
  for (const transaction of transactions) {
    const currency = transaction.currency as CurrencyCode;
    const refund: Money = { amountMinor: transaction.refundedAmount, currency };
    charged = addMoney(
      charged,
      addMoney({ amountMinor: transaction.chargedAmount, currency }, multiplyMoney(refund, -1)),
    );
    authorized = addMoney(authorized, { amountMinor: transaction.authorizedAmount, currency });
    refunded = addMoney(refunded, refund);
  }

  let chargeStatus: OrderChargeStatus;
  if (charged.amountMinor === total.amountMinor) chargeStatus = "FULL";
  else if (charged.amountMinor <= 0) chargeStatus = "NONE";
  else if (charged.amountMinor < total.amountMinor) chargeStatus = "PARTIAL";
  else chargeStatus = "OVERCHARGED";

  const covered = addMoney(authorized, charged).amountMinor;
  let authorizeStatus: OrderAuthorizeStatus;
  if (covered === 0 && total.amountMinor === 0) authorizeStatus = "FULL";
  else if (covered === 0) authorizeStatus = "NONE";
  else if (covered >= total.amountMinor) authorizeStatus = "FULL";
  else authorizeStatus = "PARTIAL";

  return {
    chargeStatus,
    authorizeStatus,
    totalCharged: charged,
    totalAuthorized: authorized,
    totalRefunded: refunded,
    totalBalance: addMoney(charged, multiplyMoney(total, -1)),
  };
}
