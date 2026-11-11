import type { CurrencyCode, Money } from "@commerce/contracts";
import { builder } from "../../graphql/builder.ts";
import { MoneyType } from "../../graphql/money.ts";
import { DateTime, UUID } from "../../graphql/scalars.ts";
import {
  netCharged,
  type PaymentEventRow,
  type PaymentTransactionRow,
  transactionActions,
} from "./index.ts";

// Saleor's TransactionItem and TransactionEvent (saleor/graphql/payment/types.py), read-only. They
// are reached through `Checkout.transactions` (the checkout id is the access token, PLAN M5
// decision 5) and the transactionInitialize payload; the checkout module adds
// `TransactionItem.checkout` and the mutation (it composes payments, ARCHITECTURE §2 rule 5).
// Amounts we don't track yet (pending, canceled) are always zero. As Saleor, a refund moves money
// from `chargedAmount` to `refundedAmount` (we store the gross charge, so charged = charged −
// refunded here).

const money = (amountMinor: number, currency: string): Money => ({
  amountMinor,
  currency: currency as CurrencyCode,
});

// Saleor's full TransactionEventTypeEnum; the database accepts only the ones we record.
const TransactionEventTypeEnum = builder.enumType("TransactionEventTypeEnum", {
  values: [
    "AUTHORIZATION_SUCCESS",
    "AUTHORIZATION_FAILURE",
    "AUTHORIZATION_ADJUSTMENT",
    "AUTHORIZATION_REQUEST",
    "AUTHORIZATION_ACTION_REQUIRED",
    "CHARGE_ACTION_REQUIRED",
    "CHARGE_SUCCESS",
    "CHARGE_FAILURE",
    "CHARGE_BACK",
    "CHARGE_REQUEST",
    "REFUND_SUCCESS",
    "REFUND_FAILURE",
    "REFUND_REVERSE",
    "REFUND_REQUEST",
    "CANCEL_SUCCESS",
    "CANCEL_FAILURE",
    "CANCEL_REQUEST",
    "INFO",
  ] as const,
});

export const TransactionActionEnum = builder.enumType("TransactionActionEnum", {
  values: ["CHARGE", "REFUND", "CANCEL"] as const,
});

export const TransactionEventType = builder.objectRef<PaymentEventRow>("TransactionEvent");

builder.node(TransactionEventType, {
  id: { resolve: (event) => event.id, description: "The ID of the object." },
  description: "Represents transaction's event.",
  fields: (t) => ({
    createdAt: t.field({
      type: DateTime,
      description: "Date and time at which a transaction event was created.",
      resolve: (event) => event.createdAt,
    }),
    pspReference: t.exposeString("pspReference", {
      description: "PSP reference of transaction.",
    }),
    message: t.exposeString("message", {
      description: "Message related to the transaction's event.",
    }),
    externalUrl: t.string({
      description:
        "The url that will allow to redirect user to payment provider page with event details.",
      resolve: () => "",
    }),
    amount: t.field({
      type: MoneyType,
      description: "The amount related to this event.",
      resolve: (event) => money(event.amount, event.currency),
    }),
    type: t.field({
      type: TransactionEventTypeEnum,
      nullable: true,
      description: "The type of action related to this event.",
      resolve: (event) => event.type as (typeof TransactionEventTypeEnum)["$inferType"],
    }),
  }),
});

export const TransactionItemType = builder.objectRef<PaymentTransactionRow>("TransactionItem");

builder.node(TransactionItemType, {
  id: { resolve: (transaction) => transaction.id, description: "The ID of the object." },
  description: "Represents a payment transaction.",
  fields: (t) => {
    const zero = (description: string) =>
      t.field({
        type: MoneyType,
        description,
        resolve: (transaction) => money(0, transaction.currency),
      });
    return {
      token: t.field({
        type: UUID,
        description: "The transaction token.",
        resolve: (transaction) => transaction.id,
      }),
      createdAt: t.field({
        type: DateTime,
        description: "Date and time at which payment transaction was created.",
        resolve: (transaction) => transaction.createdAt,
      }),
      modifiedAt: t.field({
        type: DateTime,
        description: "Date and time at which payment transaction was modified.",
        resolve: (transaction) => transaction.modifiedAt,
      }),
      actions: t.field({
        type: [TransactionActionEnum],
        description:
          "List of actions that can be requested for the transaction. Our gateways support " +
          "REFUND while a charged amount is left.",
        resolve: (transaction) => transactionActions(transaction),
      }),
      authorizedAmount: t.field({
        type: MoneyType,
        description: "Total amount authorized for this payment.",
        resolve: (transaction) => money(transaction.authorizedAmount, transaction.currency),
      }),
      authorizePendingAmount: zero(
        "Total amount of ongoing authorization requests for the transaction.",
      ),
      refundedAmount: t.field({
        type: MoneyType,
        description: "Total amount refunded for this payment.",
        resolve: (transaction) => money(transaction.refundedAmount, transaction.currency),
      }),
      refundPendingAmount: zero("Total amount of ongoing refund requests for the transaction."),
      canceledAmount: zero("Total amount canceled for this payment."),
      cancelPendingAmount: zero("Total amount of ongoing cancel requests for the transaction."),
      chargedAmount: t.field({
        type: MoneyType,
        description: "Total amount charged for this payment.",
        resolve: (transaction) => money(netCharged(transaction), transaction.currency),
      }),
      chargePendingAmount: zero("Total amount of ongoing charge requests for the transaction."),
      name: t.exposeString("name", { description: "Name of the transaction." }),
      message: t.string({ description: "Message related to the transaction.", resolve: () => "" }),
      pspReference: t.exposeString("pspReference", {
        description: "PSP reference of transaction.",
      }),
      externalUrl: t.string({
        description:
          "The url that will allow to redirect user to payment provider page with transaction details.",
        resolve: () => "",
      }),
      events: t.field({
        type: [TransactionEventType],
        description: "List of all transaction's events.",
        resolve: (transaction, _args, ctx) =>
          ctx.paymentLoaders.eventsByTransactionId.load(transaction.id),
      }),
    };
  },
});
