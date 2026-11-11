// Adapted from saleor-dashboard: src/orders/components/OrderTransaction/utils.ts and
// components/CardTitle/CardTitle.tsx getTransactionAmounts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { MessageDescriptor } from "react-intl";

import type {
  TransactionEventTypeEnum,
  TransactionItemFragment,
} from "../../../graphql/types.generated";
import { amountMessages } from "./messages";

export type TransactionEventType =
  | "AUTHORIZATION"
  | "CHARGE"
  | "CANCEL"
  | "REFUND"
  | "CHARGEBACK"
  | "AUTHORIZATION_ADJUSTMENT"
  | "REFUND_REVERSED"
  | "INFO";

export type TransactionEventStatus = "SUCCESS" | "FAILED" | "REQUEST" | "INFO";

interface TransactionMappingResult {
  type: TransactionEventType | null;
  status: TransactionEventStatus;
}

const typeMap: Record<TransactionEventTypeEnum, TransactionMappingResult> = {
  INFO: { type: "INFO", status: "INFO" },
  CHARGE_BACK: { type: "CHARGEBACK", status: "INFO" },
  REFUND_REVERSE: { type: "REFUND_REVERSED", status: "INFO" },
  AUTHORIZATION_ADJUSTMENT: { type: "AUTHORIZATION_ADJUSTMENT", status: "INFO" },
  AUTHORIZATION_FAILURE: { type: "AUTHORIZATION", status: "FAILED" },
  AUTHORIZATION_ACTION_REQUIRED: { type: "AUTHORIZATION", status: "INFO" },
  AUTHORIZATION_REQUEST: { type: "AUTHORIZATION", status: "REQUEST" },
  AUTHORIZATION_SUCCESS: { type: "AUTHORIZATION", status: "SUCCESS" },
  CHARGE_FAILURE: { type: "CHARGE", status: "FAILED" },
  CHARGE_ACTION_REQUIRED: { type: "CHARGE", status: "INFO" },
  CHARGE_REQUEST: { type: "CHARGE", status: "REQUEST" },
  CHARGE_SUCCESS: { type: "CHARGE", status: "SUCCESS" },
  CANCEL_FAILURE: { type: "CANCEL", status: "FAILED" },
  CANCEL_REQUEST: { type: "CANCEL", status: "REQUEST" },
  CANCEL_SUCCESS: { type: "CANCEL", status: "SUCCESS" },
  REFUND_FAILURE: { type: "REFUND", status: "FAILED" },
  REFUND_REQUEST: { type: "REFUND", status: "REQUEST" },
  REFUND_SUCCESS: { type: "REFUND", status: "SUCCESS" },
};

/** Saleor's mapTransactionEvent: an event's display type and status pill. */
export const mapTransactionEvent = (
  type: TransactionEventTypeEnum | null,
): TransactionMappingResult => (type ? typeMap[type] : { type: null, status: "INFO" });

/** Saleor's eventsWithoutAmount: cancel events show a dash instead of an amount. */
export const shouldShowAmount = (type: TransactionEventTypeEnum | null): boolean =>
  type !== "CANCEL_SUCCESS" && type !== "CANCEL_REQUEST" && type !== "CANCEL_FAILURE";

/** Saleor's getTransactionAmounts: the tile's non-zero amounts, in Saleor's order. */
export const getTransactionAmounts = (
  transaction: TransactionItemFragment,
): Array<{ label: MessageDescriptor; money: { amount: number; currency: string } }> =>
  [
    { label: amountMessages.charged, money: transaction.chargedAmount },
    { label: amountMessages.authorized, money: transaction.authorizedAmount },
    { label: amountMessages.refunded, money: transaction.refundedAmount },
    { label: amountMessages.canceled, money: transaction.canceledAmount },
    { label: amountMessages.chargePending, money: transaction.chargePendingAmount },
    { label: amountMessages.authorizePending, money: transaction.authorizePendingAmount },
    { label: amountMessages.refundPending, money: transaction.refundPendingAmount },
    { label: amountMessages.cancelPending, money: transaction.cancelPendingAmount },
  ].filter((item) => item.money.amount > 0);
