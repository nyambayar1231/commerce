import type { CurrencyCode, Money } from "@commerce/contracts";
import { builder } from "../../graphql/builder.ts";
import { fromGlobalId } from "../../graphql/globalId.ts";
import { TaxedMoneyType } from "../../graphql/money.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { DateTime } from "../../graphql/scalars.ts";
import { ProductVariantType } from "../catalog/productGraphql.ts";
import { TransactionItemType } from "../payments/graphql.ts";
import { getOrder, type OrderEventRow, type OrderLineRow, type OrderRow } from "./index.ts";

// Saleor's Order, OrderLine and OrderEvent (saleor/graphql/order/types.py), read-only and reduced
// to what M5.4 creates. The buyer receives the order in checkoutComplete's payload; looking one up
// by id needs MANAGE_ORDERS or owning it (PLAN M7 decision 6), and its history (`events`) needs
// MANAGE_ORDERS as in Saleor. Addresses are added by the checkout module, which owns the
// Address type (ARCHITECTURE §2 rule 2). The staff list and payment fields are in
// orderListGraphql.ts (M6.1); fulfillments, actions and the lifecycle mutations in
// lifecycleGraphql.ts (M6.4).

const MANAGE_ORDERS = "Requires one of the following permissions: MANAGE_ORDERS.";

const money = (amountMinor: number, currency: string): Money => ({
  amountMinor,
  currency: currency as CurrencyCode,
});

/** Tax is zero (ARCHITECTURE §5.2): net = gross. */
const taxed = (amountMinor: number, currency: string) => {
  const value = money(amountMinor, currency);
  return { currency: value.currency, net: value, gross: value, tax: money(0, currency) };
};

export const OrderStatusEnum = builder.enumType("OrderStatus", {
  values: ["DRAFT", "UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELED"] as const,
});

// Saleor's OrderEventsEnum values we record (PLACED at completion, M6.4's actions, M13's drafts).
const OrderEventsEnum = builder.enumType("OrderEventsEnum", {
  values: [
    "PLACED",
    "DRAFT_CREATED",
    "ADDED_PRODUCTS",
    "REMOVED_PRODUCTS",
    "PLACED_FROM_DRAFT",
    "FULFILLMENT_FULFILLED_ITEMS",
    "CANCELED",
    "ORDER_MARKED_AS_PAID",
    "TRANSACTION_REFUND_REQUESTED",
  ] as const,
});

export { money, taxed };

export const OrderType = builder.objectRef<OrderRow>("Order");
export const OrderLineType = builder.objectRef<OrderLineRow>("OrderLine");
export const OrderEventType = builder.objectRef<OrderEventRow>("OrderEvent");

builder.node(OrderEventType, {
  id: { resolve: (event) => event.id, description: "The ID of the object." },
  description: "History log of the order.",
  fields: (t) => ({
    date: t.field({
      type: DateTime,
      description: "Date when event happened at in ISO 8601 format.",
      resolve: (event) => event.createdAt,
    }),
    type: t.field({
      type: OrderEventsEnum,
      nullable: true,
      description: "Order event type.",
      resolve: (event) => event.type as (typeof OrderEventsEnum)["$inferType"],
    }),
  }),
});

builder.node(OrderLineType, {
  id: { resolve: (line) => line.id, description: "The ID of the order line." },
  description: "Represents order line of particular order.",
  fields: (t) => ({
    productName: t.exposeString("productName", {
      description: "Name of the product in order line.",
    }),
    variantName: t.exposeString("variantName", {
      description: "Name of the variant of product in order line.",
    }),
    productSku: t.exposeString("productSku", {
      nullable: true,
      description: "SKU of the product variant.",
    }),
    quantity: t.exposeInt("quantity", { description: "Number of variant items ordered." }),
    quantityFulfilled: t.exposeInt("quantityFulfilled", {
      description: "Number of variant items fulfilled.",
    }),
    unitPrice: t.field({
      type: TaxedMoneyType,
      description: "Price of the single item in the order line.",
      resolve: (line) => taxed(line.unitPriceAmount, line.currency),
    }),
    totalPrice: t.field({
      type: TaxedMoneyType,
      description: "Price of the order line.",
      resolve: (line) => taxed(line.totalPriceAmount, line.currency),
    }),
    variant: t.field({
      type: ProductVariantType,
      nullable: true,
      description:
        "A purchased product variant. Note: this field may be null if the variant has been removed from stock at all.",
      resolve: (line, _args, ctx) =>
        line.variantId === null
          ? null
          : ctx.inventoryLoaders.productVariantById.load(line.variantId),
    }),
  }),
});

builder.node(OrderType, {
  id: { resolve: (order) => order.id, description: "ID of the order." },
  description: "Represents an order in the shop.",
  fields: (t) => ({
    number: t.string({
      description: "User-friendly number of an order.",
      resolve: (order) => String(order.number),
    }),
    created: t.field({
      type: DateTime,
      description: "Date and time when the order was created.",
      resolve: (order) => order.createdAt,
    }),
    updatedAt: t.field({
      type: DateTime,
      description: "Date and time when the order was last modified.",
      resolve: (order) => order.updatedAt,
    }),
    status: t.field({
      type: OrderStatusEnum,
      description: "Status of the order.",
      resolve: (order) => order.status as (typeof OrderStatusEnum)["$inferType"],
    }),
    userEmail: t.exposeString("userEmail", {
      nullable: true,
      description: "Email address of the customer.",
    }),
    shippingMethodName: t.exposeString("shippingMethodName", {
      nullable: true,
      description: "Method used for shipping.",
    }),
    shippingPrice: t.field({
      type: TaxedMoneyType,
      description: "Total price of shipping.",
      resolve: (order) => taxed(order.shippingPriceAmount, order.currency),
    }),
    subtotal: t.field({
      type: TaxedMoneyType,
      description: "The sum of line prices not including shipping.",
      resolve: (order) => taxed(order.subtotalAmount, order.currency),
    }),
    total: t.field({
      type: TaxedMoneyType,
      description: "Total amount of the order.",
      resolve: (order) => taxed(order.totalAmount, order.currency),
    }),
    lines: t.field({
      type: [OrderLineType],
      description: "List of order lines.",
      resolve: (order, _args, ctx) => ctx.orderLoaders.linesByOrderId.load(order.id),
    }),
    events: t.field({
      type: [OrderEventType],
      nullable: { list: true, items: false },
      description: `List of events associated with the order.\n\n${MANAGE_ORDERS}`,
      resolve: async (order, _args, ctx) => {
        await requirePermission(ctx, "MANAGE_ORDERS");
        return ctx.orderLoaders.eventsByOrderId.load(order.id);
      },
    }),
    transactions: t.field({
      type: [TransactionItemType],
      description: "List of transactions for the order.",
      resolve: (order, _args, ctx) => ctx.paymentLoaders.transactionsByOrderId.load(order.id),
    }),
  }),
});

builder.objectField(TransactionItemType, "order", (t) =>
  t.field({
    type: OrderType,
    nullable: true,
    description: "The related order.",
    resolve: (transaction, _args, ctx) =>
      transaction.orderId === null ? null : getOrder(ctx.db, transaction.orderId),
  }),
);

builder.queryField("order", (t) =>
  t.field({
    type: OrderType,
    nullable: true,
    description:
      "Look up an order by ID.\n\nRequires one of the following permissions: MANAGE_ORDERS, OWNER.",
    args: { id: t.arg.id({ required: true, description: "ID of an order." }) },
    resolve: async (_parent, { id }, ctx) => {
      const order = await getOrder(ctx.db, fromGlobalId("Order", String(id)));
      // The customer the order belongs to reads it without a permission (not while it is a
      // draft, PLAN M13 decision 1); anyone else needs MANAGE_ORDERS, and is refused alike
      // whether or not the id exists.
      if (order && order.status !== "DRAFT" && ctx.user && order.userId === ctx.user.id) {
        return order;
      }
      await requirePermission(ctx, "MANAGE_ORDERS");
      return order;
    },
  }),
);
