import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { decodeGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { MoneyType } from "../../graphql/money.ts";
import { Decimal, JSON_SCALAR } from "../../graphql/scalars.ts";
import { TransactionEventType, TransactionItemType } from "../payments/graphql.ts";
import type {
  PaymentEventRow,
  PaymentTransactionRow,
  TransactionInitializeError,
} from "../payments/index.ts";
import { CheckoutType } from "./graphql.ts";
import { CheckoutNotFoundError, getCheckout } from "./index.ts";
import { checkoutPaymentStatuses, initializeCheckoutTransaction } from "./payments.ts";

// Paying for a checkout (M5.3): Saleor's transactionInitialize and the checkout's payment fields.
// The checkout module composes payments (ARCHITECTURE §2 rule 5), so it adds these fields to the
// payments module's TransactionItem as well as to Checkout. Public, like the rest of checkout.

const CheckoutAuthorizeStatusEnum = builder.enumType("CheckoutAuthorizeStatusEnum", {
  values: ["NONE", "PARTIAL", "FULL"] as const,
});

const CheckoutChargeStatusEnum = builder.enumType("CheckoutChargeStatusEnum", {
  values: ["NONE", "PARTIAL", "FULL", "OVERCHARGED"] as const,
});

const TransactionFlowStrategyEnum = builder.enumType("TransactionFlowStrategyEnum", {
  values: ["AUTHORIZATION", "CHARGE"] as const,
});

/** Totals and transactions of one checkout, through the request's loaders. */
async function paymentStatuses(checkout: { id: string }, ctx: Context) {
  const [totals, transactions] = await Promise.all([
    ctx.checkoutLoaders.totalsByCheckoutId.load(checkout.id),
    ctx.paymentLoaders.transactionsByCheckoutId.load(checkout.id),
  ]);
  return checkoutPaymentStatuses(totals.total.gross, totals.lines.length > 0, transactions);
}

builder.objectFields(CheckoutType, (t) => ({
  transactions: t.field({
    type: [TransactionItemType],
    nullable: true,
    description: "List of transactions for the checkout.",
    resolve: (checkout, _args, ctx) =>
      ctx.paymentLoaders.transactionsByCheckoutId.load(checkout.id),
  }),
  authorizeStatus: t.field({
    type: CheckoutAuthorizeStatusEnum,
    description:
      "The authorize status of the checkout: whether the transactions cover the checkout total.",
    resolve: async (checkout, _args, ctx) => (await paymentStatuses(checkout, ctx)).authorizeStatus,
  }),
  chargeStatus: t.field({
    type: CheckoutChargeStatusEnum,
    description: "The charge status of the checkout: how much of the total has been charged.",
    resolve: async (checkout, _args, ctx) => (await paymentStatuses(checkout, ctx)).chargeStatus,
  }),
  totalBalance: t.field({
    type: MoneyType,
    description: "The difference between the paid and the checkout total amount.",
    resolve: async (checkout, _args, ctx) => (await paymentStatuses(checkout, ctx)).totalBalance,
  }),
}));

builder.objectField(TransactionItemType, "checkout", (t) =>
  t.field({
    type: CheckoutType,
    nullable: true,
    description: "The related checkout.",
    resolve: (transaction, _args, ctx) =>
      transaction.checkoutId === null ? null : getCheckout(ctx.db, transaction.checkoutId),
  }),
);

const PaymentGatewayToInitialize = builder.inputType("PaymentGatewayToInitialize", {
  fields: (t) => ({
    id: t.string({
      required: true,
      description: "The identifier of the payment gateway app to initialize.",
    }),
    data: t.field({
      type: JSON_SCALAR,
      description: "The data that will be passed to the payment gateway.",
    }),
  }),
});

const TransactionInitializeErrorCode = builder.enumType("TransactionInitializeErrorCode", {
  values: ["GRAPHQL_ERROR", "INVALID", "NOT_FOUND", "UNIQUE"] as const,
});

type TransactionInitializeErrorData = {
  field: string | null;
  message: string;
  code: TransactionInitializeError["code"] | "GRAPHQL_ERROR";
};

const TransactionInitializeErrorType = builder
  .objectRef<TransactionInitializeErrorData>("TransactionInitializeError")
  .implement({
    fields: (t) => ({
      field: t.exposeString("field", {
        nullable: true,
        description:
          "Name of a field that caused the error. A value of `null` indicates that the error " +
          "isn't associated with a particular field.",
      }),
      message: t.exposeString("message", { description: "The error message." }),
      code: t.field({
        type: TransactionInitializeErrorCode,
        description: "The error code.",
        resolve: (error) => error.code,
      }),
    }),
  });

type TransactionInitializePayload = {
  transaction: PaymentTransactionRow | null;
  transactionEvent: PaymentEventRow | null;
  errors: TransactionInitializeErrorData[];
};

const TransactionInitialize = builder
  .objectRef<TransactionInitializePayload>("TransactionInitialize")
  .implement({
    description: "Initializes a transaction session.",
    fields: (t) => ({
      transaction: t.field({
        type: TransactionItemType,
        nullable: true,
        description: "The initialized transaction.",
        resolve: (payload) => payload.transaction,
      }),
      transactionEvent: t.field({
        type: TransactionEventType,
        nullable: true,
        description: "The event created for the initialized transaction.",
        resolve: (payload) => payload.transactionEvent,
      }),
      data: t.field({
        type: JSON_SCALAR,
        nullable: true,
        description: "The JSON data required to finalize the payment.",
        resolve: () => null,
      }),
      errors: t.field({
        type: [TransactionInitializeErrorType],
        resolve: (payload) => payload.errors,
      }),
    }),
  });

const failure = (
  field: string | null,
  code: TransactionInitializeErrorData["code"],
  message: string,
) => ({
  transaction: null,
  transactionEvent: null,
  errors: [{ field, code, message }],
});

builder.mutationField("transactionInitialize", (t) =>
  t.field({
    type: TransactionInitialize,
    nullable: true,
    description:
      "Initializes a transaction session. It triggers the payment gateway to process the " +
      "payment of the checkout (our built-in dummy gateway, `saleor.io.dummy-payment-app`).",
    args: {
      id: t.arg.id({ required: true, description: "The ID of the checkout." }),
      paymentGateway: t.arg({
        type: PaymentGatewayToInitialize,
        required: true,
        description: "Payment gateway used to initialize the transaction.",
      }),
      amount: t.arg({
        type: Decimal,
        description:
          "The amount requested for initializing the payment. If not provided, the difference " +
          "between checkout.total - transactions that are already processed will be send.",
      }),
      action: t.arg({
        type: TransactionFlowStrategyEnum,
        description: "The expected action called for the transaction. Defaults to CHARGE.",
      }),
      idempotencyKey: t.arg.string({
        description:
          "The idempotency key assigned to the action. It will be passed to the payment app to " +
          "discover potential duplicate actions. If not provided, the default one will be generated.",
      }),
    },
    resolve: async (_parent, { id, paymentGateway, amount, action, idempotencyKey }, ctx) => {
      // A malformed ID is the usual top-level error; another type is Saleor's INVALID.
      const decoded = decodeGlobalId(String(id));
      if (decoded.typename !== "Checkout") {
        return failure("id", "INVALID", "Couldn't resolve to Checkout.");
      }
      try {
        const result = await initializeCheckoutTransaction(ctx.db, decoded.id, {
          amount,
          action,
          gatewayId: paymentGateway.id,
          gatewayData: paymentGateway.data,
          idempotencyKey,
        });
        if (!result.ok) return { transaction: null, transactionEvent: null, errors: result.errors };
        ctx.paymentLoaders.transactionsByCheckoutId.clear(decoded.id);
        return { transaction: result.transaction, transactionEvent: result.event, errors: [] };
      } catch (error) {
        if (!(error instanceof CheckoutNotFoundError)) throw error;
        throw nodesNotFound(error.ids.map((checkoutId) => toGlobalId("Checkout", checkoutId)));
      }
    },
  }),
);
