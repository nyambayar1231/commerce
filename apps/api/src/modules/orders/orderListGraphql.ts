import type { CurrencyCode } from "@commerce/contracts";
import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId } from "../../graphql/globalId.ts";
import { MoneyType } from "../../graphql/money.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { permissionDenied, requirePermission } from "../../graphql/permissions.ts";
import { OrderDirection } from "../catalog/graphql.ts";
import { UserType } from "../identity/graphql.ts";
import { money, OrderEventType, OrderStatusEnum, OrderType } from "./graphql.ts";
import {
  InvalidOrderCursorError,
  listOrders,
  type OrderListArgs,
  type OrderPage,
  type OrderRow,
  type OrderSortField,
  type OrderStatus,
  orderPaymentSummary,
} from "./index.ts";

// Staff order reads for the dashboard (M6.1): Saleor's `orders` connection and the order's payment
// fields (PLAN M6 decision 6), plus who performed each history event. `User.orders` (M7.1) pages a
// user's own orders through the same list query.

const MANAGE_ORDERS = "Requires one of the following permissions: MANAGE_ORDERS.";

/** The order's payment summary, from its transactions (one query per page via the loader). */
async function payments(order: OrderRow, ctx: Context) {
  const transactions = await ctx.paymentLoaders.transactionsByOrderId.load(order.id);
  return orderPaymentSummary(money(order.totalAmount, order.currency), transactions);
}

const OrderChargeStatusEnum = builder.enumType("OrderChargeStatusEnum", {
  values: ["NONE", "PARTIAL", "FULL", "OVERCHARGED"] as const,
});
const OrderAuthorizeStatusEnum = builder.enumType("OrderAuthorizeStatusEnum", {
  values: ["NONE", "PARTIAL", "FULL"] as const,
});

builder.objectFields(OrderType, (t) => ({
  chargeStatus: t.field({
    type: OrderChargeStatusEnum,
    description: "The charge status of the order.",
    resolve: async (order, _args, ctx) => (await payments(order, ctx)).chargeStatus,
  }),
  authorizeStatus: t.field({
    type: OrderAuthorizeStatusEnum,
    description: "The authorize status of the order.",
    resolve: async (order, _args, ctx) => (await payments(order, ctx)).authorizeStatus,
  }),
  totalCharged: t.field({
    type: MoneyType,
    description: "Amount charged for the order (refunds deducted, as Saleor).",
    resolve: async (order, _args, ctx) => (await payments(order, ctx)).totalCharged,
  }),
  totalAuthorized: t.field({
    type: MoneyType,
    description: "Amount authorized for the order.",
    resolve: async (order, _args, ctx) => (await payments(order, ctx)).totalAuthorized,
  }),
  totalRefunded: t.field({
    type: MoneyType,
    description: "Amount refunded for the order.",
    resolve: async (order, _args, ctx) => (await payments(order, ctx)).totalRefunded,
  }),
  totalChargePending: t.field({
    type: MoneyType,
    description: "Total amount of ongoing charge requests for the order's transactions.",
    resolve: (order) => money(0, order.currency as CurrencyCode),
  }),
  totalAuthorizePending: t.field({
    type: MoneyType,
    description: "Total amount of ongoing authorize requests for the order's transactions.",
    resolve: (order) => money(0, order.currency as CurrencyCode),
  }),
  totalBalance: t.field({
    type: MoneyType,
    description: "The difference amount between the charged and the order total.",
    resolve: async (order, _args, ctx) => (await payments(order, ctx)).totalBalance,
  }),
}));

builder.objectField(OrderEventType, "user", (t) =>
  t.field({
    type: UserType,
    nullable: true,
    description: `User who performed the action.\n\n${MANAGE_ORDERS}`,
    resolve: async (event, _args, ctx) => {
      if (event.userId === null) return null;
      await requirePermission(ctx, "MANAGE_ORDERS");
      return ctx.orderLoaders.userById.load(event.userId);
    },
  }),
);

const OrderSortFieldEnum = builder.enumType("OrderSortField", {
  values: {
    NUMBER: { description: "Sort orders by number." },
    RANK: {
      description:
        "Sort orders by rank. Note: This option is available only with the `search` filter.",
    },
    CREATION_DATE: {
      description: "Sort orders by creation date.",
      deprecationReason: "Use `CREATED_AT` instead.",
    },
    CREATED_AT: { description: "Sort orders by creation date." },
    LAST_MODIFIED_AT: { description: "Sort orders by last modified date." },
    CUSTOMER: { description: "Sort orders by customer." },
    PAYMENT: { description: "Sort orders by payment status." },
    FULFILLMENT_STATUS: { description: "Sort orders by fulfillment status." },
  } as const,
});

const OrderSortingInput = builder.inputType("OrderSortingInput", {
  fields: (t) => ({
    direction: t.field({
      type: OrderDirection,
      required: true,
      description: "Specifies the direction in which to sort orders.",
    }),
    field: t.field({
      type: OrderSortFieldEnum,
      required: true,
      description: "Sort orders by the selected field.",
    }),
  }),
});

const OrderStatusEnumFilterInput = builder.inputType("OrderStatusEnumFilterInput", {
  description: "Filter by order status.",
  fields: (t) => ({
    eq: t.field({ type: OrderStatusEnum, description: "The value equal to." }),
    oneOf: t.field({ type: [OrderStatusEnum], description: "The value included in." }),
  }),
});

// Saleor's OrderWhereInput reduced to the status filter the dashboard uses (PLAN M6 decision 3).
const OrderWhereInput = builder.inputType("OrderWhereInput", {
  fields: (t) => ({
    ids: t.idList({ description: "Filter by order IDs." }),
    status: t.field({ type: OrderStatusEnumFilterInput, description: "Filter by order status." }),
  }),
});

const OrderConnection = builder.connectionObject(
  {
    type: OrderType,
    name: "OrderCountableConnection",
    fields: (t) => ({
      totalCount: t.int({
        nullable: true,
        description: "A total count of items in the collection.",
        resolve: (connection) => (connection as unknown as OrderPage).totalCount,
      }),
    }),
  },
  { name: "OrderCountableEdge" },
);

/** The connection shape Pothos expects, from a page of the order list. */
const toConnection = (result: OrderPage) => ({
  ...result,
  edges: result.rows,
  pageInfo: {
    hasNextPage: result.hasNextPage,
    hasPreviousPage: result.hasPreviousPage,
    startCursor: result.rows[0]?.cursor ?? null,
    endCursor: result.rows.at(-1)?.cursor ?? null,
  },
});

/** Lists orders, reporting a foreign cursor as Saleor does. */
async function listOrdersOrThrow(ctx: Context, args: OrderListArgs) {
  try {
    return toConnection(await listOrders(ctx.db, args));
  } catch (error) {
    if (error instanceof InvalidOrderCursorError) throw new GraphQLError(error.message);
    throw error;
  }
}

// Saleor's Order.user (saleor/graphql/order/types.py resolve_user): the account that placed the
// order, for its owner or staff with MANAGE_USERS, MANAGE_ORDERS or HANDLE_PAYMENTS (Saleor's
// HANDLE_TAXES doesn't exist here). The dashboard links it as "View profile" (M7.5).
builder.objectField(OrderType, "user", (t) =>
  t.field({
    type: UserType,
    nullable: true,
    description:
      "User who placed the order. Requires one of the following permissions: MANAGE_USERS, " +
      "MANAGE_ORDERS, HANDLE_PAYMENTS, OWNER.",
    resolve: async (order, _args, ctx) => {
      if (order.userId === null) return null;
      if (ctx.user?.id !== order.userId) {
        await requirePermission(ctx, "MANAGE_USERS", "MANAGE_ORDERS", "HANDLE_PAYMENTS");
      }
      return ctx.orderLoaders.userById.load(order.userId);
    },
  }),
);

// Saleor's CustomerOrderWhereInput, limited to the status filter (the customer page counts the
// orders that are not cancelled, M7.5).
const CustomerOrderWhereInput = builder.inputType("CustomerOrderWhereInput", {
  fields: (t) => ({
    status: t.field({ type: OrderStatusEnumFilterInput, description: "Filter by order status." }),
  }),
});

// Saleor's User.orders (saleor/graphql/account/types.py resolve_orders): the user's own orders for
// themselves, anyone's for MANAGE_ORDERS staff; newest first (Saleor's Order ordering, -number).
builder.objectField(UserType, "orders", (t) =>
  t.connection(
    {
      type: OrderType,
      nullable: true,
      description:
        "List of user's orders. Requires one of the following permissions: MANAGE_ORDERS, OWNER.",
      args: {
        where: t.arg({
          type: CustomerOrderWhereInput,
          description: "Where filtering options for orders.",
        }),
      },
      resolve: async (user, { where, ...args }, ctx, info) => {
        if (ctx.user?.id !== user.id) {
          const granted = ctx.user?.isStaff ? await ctx.permissions() : [];
          if (!granted.includes("MANAGE_ORDERS")) {
            throw permissionDenied(["OWNER", "MANAGE_ORDERS"]);
          }
        }
        const page = validatePagination("orders", args, isEdgesRequested(info));
        return listOrdersOrThrow(ctx, {
          ...args,
          ...page,
          where: {
            userId: user.id,
            status: where?.status
              ? {
                  eq: where.status.eq as OrderStatus | null | undefined,
                  oneOf: where.status.oneOf as OrderStatus[] | null | undefined,
                }
              : undefined,
          },
          sort: { field: "NUMBER", direction: "DESC" },
        });
      },
    },
    OrderConnection,
  ),
);

builder.queryField("orders", (t) =>
  t.connection(
    {
      type: OrderType,
      nullable: true,
      description: `List of orders.\n\n${MANAGE_ORDERS}`,
      args: {
        sortBy: t.arg({ type: OrderSortingInput, description: "Sort orders." }),
        where: t.arg({ type: OrderWhereInput, description: "Where filtering options for orders." }),
        search: t.arg.string({ description: "Search orders." }),
      },
      resolve: async (_parent, { sortBy, where, search, ...args }, ctx, info) => {
        await requirePermission(ctx, "MANAGE_ORDERS");
        const page = validatePagination("orders", args, isEdgesRequested(info));
        const listArgs: OrderListArgs = {
          ...args,
          ...page,
          search,
          sort: sortBy
            ? { field: sortBy.field as OrderSortField, direction: sortBy.direction }
            : null,
          where: where
            ? {
                ids: where.ids?.map((id) => fromGlobalId("Order", String(id))) ?? undefined,
                status: where.status
                  ? {
                      eq: where.status.eq as OrderStatus | null | undefined,
                      oneOf: where.status.oneOf as OrderStatus[] | null | undefined,
                    }
                  : undefined,
              }
            : null,
        };
        return listOrdersOrThrow(ctx, listArgs);
      },
    },
    OrderConnection,
  ),
);

// Saleor's draftOrders (saleor/graphql/order/schema.py resolve_draft_orders): the drafts only,
// with the orders list's sorting and search (PLAN M13 decision 1). No `where`/`filter` yet.
builder.queryField("draftOrders", (t) =>
  t.connection(
    {
      type: OrderType,
      nullable: true,
      description: `List of draft orders.\n\n${MANAGE_ORDERS}`,
      args: {
        sortBy: t.arg({ type: OrderSortingInput, description: "Sort draft orders." }),
        search: t.arg.string({ description: "Search draft orders." }),
      },
      resolve: async (_parent, { sortBy, search, ...args }, ctx, info) => {
        await requirePermission(ctx, "MANAGE_ORDERS");
        const page = validatePagination("draftOrders", args, isEdgesRequested(info));
        return listOrdersOrThrow(ctx, {
          ...args,
          ...page,
          search,
          sort: sortBy
            ? { field: sortBy.field as OrderSortField, direction: sortBy.direction }
            : null,
          where: { drafts: true },
        });
      },
    },
    OrderConnection,
  ),
);
