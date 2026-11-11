import { CURRENCIES, type CurrencyCode, parseDecimal } from "@commerce/contracts";
import { builder } from "../../graphql/builder.ts";
import { fromGlobalId, toGlobalId } from "../../graphql/globalId.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { DateTime, Decimal, UUID } from "../../graphql/scalars.ts";
import { WarehouseType } from "../inventory/graphql.ts";
import { getWarehouse } from "../inventory/index.ts";
import { TransactionActionEnum, TransactionItemType } from "../payments/graphql.ts";
import { getTransaction, type PaymentTransactionRow } from "../payments/index.ts";
import { OrderEventType, OrderLineType, OrderType } from "./graphql.ts";
import {
  cancelOrder,
  type FulfillmentLineRow,
  type FulfillmentRow,
  fulfillOrder,
  getFulfillmentLinesByIds,
  getOrderLinesByIds,
  markOrderAsPaid,
  type OrderError,
  type OrderRow,
  type RefundError,
  refundOrderTransaction,
  uncoveredAmount,
} from "./index.ts";

// Saleor's order lifecycle API (saleor/graphql/order/mutations/order_fulfill.py, order_cancel.py,
// order_mark_as_paid.py, saleor/graphql/payment/mutations/transaction/transaction_request_action.py)
// for PLAN M6.4: Fulfillment and FulfillmentLine, the fields the dashboard's actions read
// (Order.fulfillments, Order.actions, OrderLine.quantityToFulfill, OrderEvent details) and the four
// mutations. Left out: tracking numbers, notifyCustomer, allowStockToBeExceeded, fulfillment
// approval/cancel, CHARGE and CANCEL transaction actions, refund reasons.

const MANAGE_ORDERS = "Requires one of the following permissions: MANAGE_ORDERS.";
const HANDLE_PAYMENTS = "Requires one of the following permissions: HANDLE_PAYMENTS.";

// ── Types ────────────────────────────────────────────────────────────────────────────────────

// Saleor's full FulfillmentStatus; we create only FULFILLED.
const FulfillmentStatusEnum = builder.enumType("FulfillmentStatus", {
  values: [
    "FULFILLED",
    "REFUNDED",
    "RETURNED",
    "REPLACED",
    "REFUNDED_AND_RETURNED",
    "CANCELED",
    "WAITING_FOR_APPROVAL",
  ] as const,
});

export const FulfillmentType = builder.objectRef<FulfillmentRow>("Fulfillment");
export const FulfillmentLineType = builder.objectRef<FulfillmentLineRow>("FulfillmentLine");

builder.node(FulfillmentLineType, {
  id: { resolve: (line) => line.id, description: "The ID of the object." },
  description: "Represents line of the fulfillment.",
  fields: (t) => ({
    quantity: t.exposeInt("quantity", {
      description: "The number of items included in the fulfillment line.",
    }),
    orderLine: t.field({
      type: OrderLineType,
      nullable: true,
      description: "The order line to which the fulfillment line is related.",
      resolve: async (line, _args, ctx) =>
        (await getOrderLinesByIds(ctx.db, [line.orderLineId]))[0] ?? null,
    }),
  }),
});

builder.node(FulfillmentType, {
  id: { resolve: (fulfillment) => fulfillment.id, description: "The ID of the object." },
  description: "Represents order fulfillment.",
  fields: (t) => ({
    fulfillmentOrder: t.exposeInt("fulfillmentOrder", {
      description: "Sequence in which the fulfillments were created for an order.",
    }),
    status: t.field({
      type: FulfillmentStatusEnum,
      description: "Status of fulfillment.",
      resolve: (fulfillment) => fulfillment.status as (typeof FulfillmentStatusEnum)["$inferType"],
    }),
    trackingNumber: t.string({
      description: "Fulfillment tracking number.",
      resolve: () => "",
    }),
    created: t.field({
      type: DateTime,
      description: "Date and time when fulfillment was created.",
      resolve: (fulfillment) => fulfillment.createdAt,
    }),
    lines: t.field({
      type: [FulfillmentLineType],
      nullable: true,
      description: "List of lines for the fulfillment.",
      resolve: (fulfillment, _args, ctx) =>
        ctx.orderLoaders.fulfillmentLinesByFulfillmentId.load(fulfillment.id),
    }),
    warehouse: t.field({
      type: WarehouseType,
      nullable: true,
      description: "Warehouse from fulfillment was fulfilled.",
      resolve: (fulfillment, _args, ctx) =>
        fulfillment.warehouseId === null ? null : getWarehouse(ctx.db, fulfillment.warehouseId),
    }),
  }),
});

// Saleor's OrderAction; we offer MARK_AS_PAID only (refunds are a transaction action).
const OrderActionEnum = builder.enumType("OrderAction", {
  values: ["CAPTURE", "MARK_AS_PAID", "REFUND", "VOID"] as const,
});

builder.objectFields(OrderType, (t) => ({
  fulfillments: t.field({
    type: [FulfillmentType],
    description: "List of shipments for the order.",
    resolve: (order, _args, ctx) => ctx.orderLoaders.fulfillmentsByOrderId.load(order.id),
  }),
  actions: t.field({
    type: [OrderActionEnum],
    description:
      "List of actions that can be performed in the current state of an order. MARK_AS_PAID " +
      "while the transactions leave part of the total uncharged.",
    resolve: async (order, _args, ctx) => {
      const transactions = await ctx.paymentLoaders.transactionsByOrderId.load(order.id);
      return uncoveredAmount(order, transactions) > 0 ? ["MARK_AS_PAID" as const] : [];
    },
  }),
}));

builder.objectField(OrderLineType, "quantityToFulfill", (t) =>
  t.int({
    description: "A quantity of items remaining to be fulfilled.",
    resolve: (line) => line.quantity - line.quantityFulfilled,
  }),
);

/** An event payload's value, read defensively (jsonb). */
const payloadValue = (payload: unknown, key: string): unknown =>
  payload && typeof payload === "object" ? (payload as Record<string, unknown>)[key] : undefined;

builder.objectFields(OrderEventType, (t) => ({
  amount: t.float({
    nullable: true,
    description: "Amount of money.",
    resolve: (event) => {
      const amount = payloadValue(event.payload, "amount");
      const currency = payloadValue(event.payload, "currency");
      if (typeof amount !== "number" || typeof currency !== "string" || !(currency in CURRENCIES)) {
        return null;
      }
      return amount / 10 ** CURRENCIES[currency as CurrencyCode].exponent;
    },
  }),
  transactionReference: t.string({
    nullable: true,
    description: "The transaction reference of captured payment.",
    resolve: (event) => {
      const reference = payloadValue(event.payload, "transactionReference");
      return typeof reference === "string" ? reference : null;
    },
  }),
  fulfilledItems: t.field({
    type: [FulfillmentLineType],
    nullable: true,
    description: "List of fulfilled items.",
    resolve: (event, _args, ctx) => {
      const ids = payloadValue(event.payload, "fulfilledItems");
      return Array.isArray(ids)
        ? getFulfillmentLinesByIds(
            ctx.db,
            ids.filter((id): id is string => typeof id === "string"),
          )
        : null;
    },
  }),
}));

// ── Errors ───────────────────────────────────────────────────────────────────────────────────

// Saleor's OrderErrorCode values our order mutations return.
const OrderErrorCodeEnum = builder.enumType("OrderErrorCode", {
  values: [
    "CANNOT_CANCEL_ORDER",
    "DUPLICATED_INPUT_ITEM",
    "FULFILL_ORDER_LINE",
    "GRAPHQL_ERROR",
    "INSUFFICIENT_STOCK",
    "INVALID",
    "INVALID_QUANTITY",
    "NOT_FOUND",
    "TRANSACTION_ERROR",
    "ZERO_QUANTITY",
  ] as const,
});

type OrderErrorData = {
  field: string | null;
  message: string;
  code: (typeof OrderErrorCodeEnum)["$inferType"];
  warehouse: string | null;
  orderLines: string[] | null;
};

const OrderErrorType = builder.objectRef<OrderErrorData>("OrderError").implement({
  fields: (t) => ({
    field: t.exposeString("field", {
      nullable: true,
      description:
        "Name of a field that caused the error. A value of `null` indicates that the error " +
        "isn't associated with a particular field.",
    }),
    message: t.exposeString("message", { description: "The error message." }),
    code: t.field({
      type: OrderErrorCodeEnum,
      description: "The error code.",
      resolve: (error) => error.code,
    }),
    warehouse: t.id({
      nullable: true,
      description: "Warehouse ID which causes the error.",
      resolve: (error) => error.warehouse,
    }),
    orderLines: t.idList({
      nullable: true,
      description: "List of order line IDs that cause the error.",
      resolve: (error) => error.orderLines,
    }),
  }),
});

/** Domain errors carry primary keys; the API exposes global IDs. */
const toOrderError = (error: OrderError): OrderErrorData => ({
  field: error.field,
  message: error.message,
  code: error.code,
  warehouse: error.warehouse ? toGlobalId("Warehouse", error.warehouse) : null,
  orderLines: error.orderLines?.map((id) => toGlobalId("OrderLine", id)) ?? null,
});

const TransactionRequestActionErrorCodeEnum = builder.enumType(
  "TransactionRequestActionErrorCode",
  {
    values: [
      "INVALID",
      "REQUIRED",
      "GRAPHQL_ERROR",
      "NOT_FOUND",
      "MISSING_TRANSACTION_ACTION_REQUEST_WEBHOOK",
    ] as const,
  },
);

type TransactionRequestActionErrorData = {
  field: string | null;
  message: string;
  code: (typeof TransactionRequestActionErrorCodeEnum)["$inferType"];
};

const TransactionRequestActionErrorType = builder
  .objectRef<TransactionRequestActionErrorData>("TransactionRequestActionError")
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
        type: TransactionRequestActionErrorCodeEnum,
        description: "The error code.",
        resolve: (error) => error.code,
      }),
    }),
  });

// ── Payloads ─────────────────────────────────────────────────────────────────────────────────

type OrderPayloadData = { order: OrderRow | null; errors: OrderErrorData[] };

const orderPayload = (name: string, description: string) =>
  builder.objectRef<OrderPayloadData>(name).implement({
    fields: (t) => ({
      order: t.field({ type: OrderType, nullable: true, description, resolve: (p) => p.order }),
      errors: t.field({ type: [OrderErrorType], resolve: (p) => p.errors }),
    }),
  });

const OrderCancelPayload = orderPayload("OrderCancel", "Canceled order.");
const OrderMarkAsPaidPayload = orderPayload("OrderMarkAsPaid", "Order marked as paid.");

const OrderFulfillPayload = builder
  .objectRef<OrderPayloadData & { fulfillments: FulfillmentRow[] | null }>("OrderFulfill")
  .implement({
    fields: (t) => ({
      fulfillments: t.field({
        type: [FulfillmentType],
        nullable: true,
        description: "List of created fulfillments.",
        resolve: (p) => p.fulfillments,
      }),
      order: t.field({
        type: OrderType,
        nullable: true,
        description: "Fulfilled order.",
        resolve: (p) => p.order,
      }),
      errors: t.field({ type: [OrderErrorType], resolve: (p) => p.errors }),
    }),
  });

const TransactionRequestActionPayload = builder
  .objectRef<{
    transaction: PaymentTransactionRow | null;
    errors: TransactionRequestActionErrorData[];
  }>("TransactionRequestAction")
  .implement({
    fields: (t) => ({
      transaction: t.field({
        type: TransactionItemType,
        nullable: true,
        resolve: (p) => p.transaction,
      }),
      errors: t.field({ type: [TransactionRequestActionErrorType], resolve: (p) => p.errors }),
    }),
  });

// ── Inputs ───────────────────────────────────────────────────────────────────────────────────

const OrderFulfillStockInput = builder.inputType("OrderFulfillStockInput", {
  fields: (t) => ({
    quantity: t.int({
      required: true,
      description: "The number of line items to be fulfilled from given warehouse.",
    }),
    warehouse: t.id({
      required: true,
      description: "ID of the warehouse from which the item will be fulfilled.",
    }),
  }),
});

const OrderFulfillLineInput = builder.inputType("OrderFulfillLineInput", {
  fields: (t) => ({
    orderLineId: t.id({ description: "The ID of the order line." }),
    stocks: t.field({
      type: [OrderFulfillStockInput],
      required: true,
      description: "List of stock items to create.",
    }),
  }),
});

const OrderFulfillInput = builder.inputType("OrderFulfillInput", {
  fields: (t) => ({
    lines: t.field({
      type: [OrderFulfillLineInput],
      required: true,
      description: "List of items informing how to fulfill the order.",
    }),
  }),
});

// ── Mutations ────────────────────────────────────────────────────────────────────────────────

builder.mutationField("orderFulfill", (t) =>
  t.field({
    type: OrderFulfillPayload,
    nullable: true,
    description: `Creates new fulfillments for an order.\n\n${MANAGE_ORDERS}`,
    args: {
      order: t.arg.id({ description: "ID of the order to be fulfilled." }),
      input: t.arg({
        type: OrderFulfillInput,
        required: true,
        description: "Fields required to create a fulfillment.",
      }),
    },
    resolve: async (_parent, { order, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      if (order == null) {
        return {
          order: null,
          fulfillments: null,
          errors: [
            toOrderError({ field: "order", code: "NOT_FOUND", message: "Order does not exist." }),
          ],
        };
      }
      const result = await fulfillOrder(ctx.db, {
        orderId: fromGlobalId("Order", String(order)),
        userId: ctx.user?.id ?? null,
        lines: input.lines.map((line) => ({
          // Saleor's orderLineId is optional in the schema but required by the mutation.
          orderLineId: fromGlobalId("OrderLine", String(line.orderLineId)),
          stocks: line.stocks.map((stock) => ({
            warehouseId: fromGlobalId("Warehouse", String(stock.warehouse)),
            quantity: stock.quantity,
          })),
        })),
      });
      return result.ok
        ? { order: result.order, fulfillments: result.fulfillments, errors: [] }
        : { order: null, fulfillments: null, errors: result.errors.map(toOrderError) };
    },
  }),
);

builder.mutationField("orderCancel", (t) =>
  t.field({
    type: OrderCancelPayload,
    nullable: true,
    description: `Cancel an order.\n\n${MANAGE_ORDERS}`,
    args: { id: t.arg.id({ required: true, description: "ID of the order to cancel." }) },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const result = await cancelOrder(ctx.db, {
        orderId: fromGlobalId("Order", String(id)),
        userId: ctx.user?.id ?? null,
      });
      return result.ok
        ? { order: result.order, errors: [] }
        : { order: null, errors: result.errors.map(toOrderError) };
    },
  }),
);

builder.mutationField("orderMarkAsPaid", (t) =>
  t.field({
    type: OrderMarkAsPaidPayload,
    nullable: true,
    description: `Mark order as manually paid.\n\n${MANAGE_ORDERS}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of the order to mark paid." }),
      transactionReference: t.arg.string({ description: "The external transaction reference." }),
    },
    resolve: async (_parent, { id, transactionReference }, ctx) => {
      await requirePermission(ctx, "MANAGE_ORDERS");
      const result = await markOrderAsPaid(ctx.db, {
        orderId: fromGlobalId("Order", String(id)),
        userId: ctx.user?.id ?? null,
        transactionReference: transactionReference?.trim() || null,
      });
      return result.ok
        ? { order: result.order, errors: [] }
        : { order: null, errors: result.errors.map(toOrderError) };
    },
  }),
);

const refundError = (
  field: string | null,
  code: RefundError["code"] | "REQUIRED",
  message: string,
): { transaction: null; errors: TransactionRequestActionErrorData[] } => ({
  transaction: null,
  errors: [{ field, code, message }],
});

builder.mutationField("transactionRequestAction", (t) =>
  t.field({
    type: TransactionRequestActionPayload,
    nullable: true,
    description: `Request an action for payment transaction.\n\n${HANDLE_PAYMENTS}`,
    args: {
      id: t.arg.id({
        description: "The ID of the transaction. One of field id or token is required.",
      }),
      token: t.arg({
        type: UUID,
        description: "The token of the transaction. One of field id or token is required.",
      }),
      actionType: t.arg({
        type: TransactionActionEnum,
        required: true,
        description: "Determines the action type.",
      }),
      amount: t.arg({
        type: Decimal,
        description: "Transaction request amount. If empty, maximal possible amount will be used.",
      }),
    },
    resolve: async (_parent, { id, token, actionType, amount }, ctx) => {
      await requirePermission(ctx, "HANDLE_PAYMENTS");
      if ((id == null) === (token == null)) {
        return refundError(null, "REQUIRED", "Argument 'id' or 'token' is required.");
      }
      const transactionId =
        id != null ? fromGlobalId("TransactionItem", String(id)) : String(token);
      if (actionType !== "REFUND") {
        return refundError(
          "actionType",
          "INVALID",
          "Our payment gateways support only the REFUND action.",
        );
      }

      let amountMinor: number | null = null;
      if (amount != null) {
        const transaction = await getTransaction(ctx.db, transactionId);
        if (!transaction) return refundError("id", "NOT_FOUND", "Transaction does not exist.");
        try {
          amountMinor = parseDecimal(
            String(amount),
            transaction.currency as CurrencyCode,
          ).amountMinor;
        } catch {
          return refundError("amount", "INVALID", "The amount is not a valid money value.");
        }
      }
      const result = await refundOrderTransaction(ctx.db, {
        transactionId,
        amount: amountMinor,
        userId: ctx.user?.id ?? null,
      });
      return result.ok
        ? { transaction: result.transaction, errors: [] }
        : { transaction: null, errors: result.errors };
    },
  }),
);
