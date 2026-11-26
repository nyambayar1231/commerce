import { builder } from "../../graphql/builder.ts";
import { decodeGlobalId } from "../../graphql/globalId.ts";
import { JSON_SCALAR } from "../../graphql/scalars.ts";
import { logger } from "../../logger.ts";
import { GatewayUnavailableError } from "./gateways/types.ts";
import { TransactionEventType, TransactionItemType } from "./graphql.ts";
import {
  applyGatewayStatus,
  getEventsByTransactionIds,
  getTransaction,
  type PaymentEventRow,
  type PaymentTransactionRow,
} from "./transactions.ts";

// Saleor's transactionProcess (saleor/graphql/payment/mutations/transaction/transaction_process.py)
// for a gateway the shopper paid on its own page (ADR-0016): the storefront's return page asks the
// API to read the payment at its gateway now, instead of waiting for the webhook. Public, as in
// Saleor (the transaction id is random); it only reads the gateway and records what changed, so
// calling it again is harmless.

type ProcessErrorCode = "INVALID" | "NOT_FOUND" | "MISSING_PAYMENT_APP";

const TransactionProcessErrorCodeEnum = builder.enumType("TransactionProcessErrorCode", {
  values: [
    "GRAPHQL_ERROR",
    "INVALID",
    "NOT_FOUND",
    "TRANSACTION_ALREADY_PROCESSED",
    "MISSING_PAYMENT_APP_RELATION",
    "MISSING_PAYMENT_APP",
    "CHECKOUT_COMPLETION_IN_PROGRESS",
  ] as const,
});

type ProcessError = { field: string | null; code: ProcessErrorCode; message: string };

const TransactionProcessError = builder
  .objectRef<ProcessError>("TransactionProcessError")
  .implement({
    fields: (t) => ({
      field: t.exposeString("field", {
        nullable: true,
        description: "Name of a field that caused the error.",
      }),
      message: t.exposeString("message", { description: "The error message." }),
      code: t.field({
        type: TransactionProcessErrorCodeEnum,
        description: "The error code.",
        resolve: (error) => error.code,
      }),
    }),
  });

type Payload = {
  transaction: PaymentTransactionRow | null;
  transactionEvent: PaymentEventRow | null;
  data: { url: string } | null;
  errors: ProcessError[];
};

const TransactionProcess = builder.objectRef<Payload>("TransactionProcess").implement({
  description: "Processes a transaction session.",
  fields: (t) => ({
    transaction: t.field({
      type: TransactionItemType,
      nullable: true,
      description: "The processed transaction.",
      resolve: (payload) => payload.transaction,
    }),
    transactionEvent: t.field({
      type: TransactionEventType,
      nullable: true,
      description: "The event created for the processed transaction.",
      resolve: (payload) => payload.transactionEvent,
    }),
    data: t.field({
      type: JSON_SCALAR,
      nullable: true,
      description: "The json data required to finalize the payment.",
      resolve: (payload) => payload.data,
    }),
    errors: t.field({ type: [TransactionProcessError], resolve: (payload) => payload.errors }),
  }),
});

const failure = (field: string | null, code: ProcessErrorCode, message: string): Payload => ({
  transaction: null,
  transactionEvent: null,
  data: null,
  errors: [{ field, code, message }],
});

builder.mutationField("transactionProcess", (t) =>
  t.field({
    type: TransactionProcess,
    nullable: true,
    description:
      "Processes a transaction session. It reads the payment at its gateway (e.g. after the " +
      "customer returned from the gateway's page) and records what changed.",
    args: {
      id: t.arg.id({
        description: "The ID of the transaction. One of field id or token is required.",
      }),
      token: t.arg({
        type: "UUID",
        description: "The token of the transaction. One of field id or token is required.",
      }),
      data: t.arg({
        type: JSON_SCALAR,
        description: "The data that will be passed to the payment gateway.",
      }),
    },
    resolve: async (_parent, { id, token }, ctx) => {
      let transactionId: string | null = null;
      if (id != null) {
        const decoded = decodeGlobalId(String(id));
        if (decoded.typename !== "TransactionItem") {
          return failure("id", "INVALID", "Couldn't resolve to TransactionItem.");
        }
        transactionId = decoded.id;
      } else if (token != null) {
        transactionId = String(token);
      }
      if (transactionId === null) {
        return failure("id", "INVALID", "At least one of arguments is required: 'id', 'token'.");
      }
      const transaction = await getTransaction(ctx.db, transactionId);
      if (!transaction) return failure("id", "NOT_FOUND", "Transaction does not exist.");
      if (ctx.gateways.forTransaction(transaction.provider) === null) {
        return failure(
          "id",
          "MISSING_PAYMENT_APP",
          "The transaction's payment app is not available.",
        );
      }

      let current = transaction;
      // Only a payment still waiting at its gateway is read; a settled one is returned as it is.
      if (transaction.chargePendingAmount > 0 && transaction.pspReference !== "") {
        try {
          current = (await applyGatewayStatus(ctx.db, ctx.gateways, transaction.id)).transaction;
        } catch (error) {
          if (!(error instanceof GatewayUnavailableError)) throw error;
          logger.warn({ err: error, transactionId }, "transactionProcess: gateway unavailable");
        }
      }
      const events = await getEventsByTransactionIds(ctx.db, [current.id]);
      const latest = events.at(-1) ?? null;
      ctx.paymentLoaders.eventsByTransactionId.clear(current.id);
      return {
        transaction: current,
        transactionEvent: latest,
        data:
          current.chargePendingAmount > 0 && current.externalUrl
            ? { url: current.externalUrl }
            : null,
        errors: [],
      };
    },
  }),
);
