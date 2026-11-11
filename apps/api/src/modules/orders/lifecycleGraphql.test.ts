import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import {
  completeCheckout,
  createCheckout,
  createShippingMethod,
  initializeCheckoutTransaction,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
} from "../checkout/index.ts";
import { DUMMY_GATEWAY_ID, getTransactionsByOrderIds } from "../payments/index.ts";
import { getOrderLinesByOrderIds } from "./index.ts";

// The lifecycle mutations through the API (PLAN M6.4): permissions, payload shapes with global
// IDs, and the fields the dashboard reads afterwards. Behaviour and races are in lifecycle.test.ts.
const db = getDb();
const client = createTestClient(db);
let warehouseId: string;

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, "order", checkout, product, shipping_method, allocation, payment_transaction, fulfillment CASCADE',
  );
  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  warehouseId = warehouse.id;
});

afterAll(async () => {
  await closeDb();
});

async function gql<T>(query: string, variables: object, token?: string): Promise<T> {
  const { body } = await client.gql(query, variables, token);
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data as T;
}

/** A paid order of 2 × 1,000 MNT + 500 shipping from tracked stock (5 units). */
async function placeOrder() {
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: `boots-${crypto.randomUUID()}`, isPublished: true })
    .returning();
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product?.id ?? "",
      name: "42",
      sku: `B-${crypto.randomUUID()}`,
      priceAmount: 1000,
      currency: "MNT",
      trackInventory: true,
    })
    .returning();
  await db.insert(schema.stock).values({ warehouseId, variantId: variant?.id ?? "", quantity: 5 });
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error("no shipping");
  const created = await createCheckout(db, {
    lines: [{ variantId: variant?.id ?? "", quantity: 2 }],
    email: "buyer@example.com",
  });
  if (!created.ok) throw new Error("no checkout");
  const id = created.checkout.id;
  const address = {
    firstName: "Bat",
    lastName: "Dorj",
    streetAddress1: "A 1",
    city: "UB",
    country: "MN",
  };
  await updateCheckoutAddress(db, id, "SHIPPING", address);
  await updateCheckoutAddress(db, id, "BILLING", address);
  await updateCheckoutDeliveryMethod(db, id, method.shippingMethod.id);
  await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
  const result = await completeCheckout(db, id);
  if (!result.ok) throw new Error("not placed");
  const [line] = await getOrderLinesByOrderIds(db, [result.order.id]);
  const [transaction] = await getTransactionsByOrderIds(db, [result.order.id]);
  return {
    orderId: toGlobalId("Order", result.order.id),
    lineId: toGlobalId("OrderLine", line?.id ?? ""),
    transactionId: toGlobalId("TransactionItem", transaction?.id ?? ""),
    transactionToken: transaction?.id ?? "",
  };
}

const FULFILL = `mutation($order: ID, $input: OrderFulfillInput!) {
  orderFulfill(order: $order, input: $input) {
    fulfillments { fulfillmentOrder status trackingNumber warehouse { id } lines { quantity orderLine { id } } }
    order { status lines { quantityFulfilled quantityToFulfill } }
    errors { field code message orderLines warehouse }
  }
}`;
const CANCEL = `mutation($id: ID!) { orderCancel(id: $id) { order { status } errors { field code } } }`;
const MARK_AS_PAID = `mutation($id: ID!, $ref: String) {
  orderMarkAsPaid(id: $id, transactionReference: $ref) { order { chargeStatus actions } errors { field code message } }
}`;
const REFUND = `mutation($id: ID, $token: UUID, $action: TransactionActionEnum!, $amount: Decimal) {
  transactionRequestAction(id: $id, token: $token, actionType: $action, amount: $amount) {
    transaction { chargedAmount { amount } refundedAmount { amount } actions events { type amount { amount } } }
    errors { field code message }
  }
}`;
const ORDER = `query($id: ID!) { order(id: $id) {
  status actions chargeStatus totalCharged { amount } totalRefunded { amount }
  fulfillments { fulfillmentOrder lines { quantity } }
  events { type user { email } amount transactionReference fulfilledItems { quantity orderLine { id } } }
} }`;

describe("order lifecycle mutations", () => {
  it("require MANAGE_ORDERS, and HANDLE_PAYMENTS for refunds", async () => {
    const order = await placeOrder();
    const payments = await createStaff(db, ["HANDLE_PAYMENTS"]);
    const orders = await createStaff(db, ["MANAGE_ORDERS"]);
    const input = { lines: [{ orderLineId: order.lineId, stocks: [] }] };

    expectPermissionDenied(
      await client.gql(FULFILL, { order: order.orderId, input }, payments.token),
      ["MANAGE_ORDERS"],
    );
    expectPermissionDenied(await client.gql(CANCEL, { id: order.orderId }, payments.token), [
      "MANAGE_ORDERS",
    ]);
    expectPermissionDenied(await client.gql(MARK_AS_PAID, { id: order.orderId }), [
      "MANAGE_ORDERS",
    ]);
    expectPermissionDenied(
      await client.gql(REFUND, { id: order.transactionId, action: "REFUND" }, orders.token),
      ["HANDLE_PAYMENTS"],
    );
  });

  it("fulfill: fulfillments, order lines, history and Saleor's errors with global IDs", async () => {
    const order = await placeOrder();
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const warehouse = toGlobalId("Warehouse", warehouseId);
    const fulfill = (quantity: number) =>
      gql<{ orderFulfill: unknown }>(
        FULFILL,
        {
          order: order.orderId,
          input: { lines: [{ orderLineId: order.lineId, stocks: [{ warehouse, quantity }] }] },
        },
        staff.token,
      );

    expect((await fulfill(3)).orderFulfill).toEqual({
      fulfillments: null,
      order: null,
      errors: [
        {
          field: "orderLineId",
          code: "FULFILL_ORDER_LINE",
          message: "Only 2 items remaining to fulfill.",
          orderLines: [order.lineId],
          warehouse: null,
        },
      ],
    });
    expect((await fulfill(1)).orderFulfill).toEqual({
      fulfillments: [
        {
          fulfillmentOrder: 1,
          status: "FULFILLED",
          trackingNumber: "",
          warehouse: { id: warehouse },
          lines: [{ quantity: 1, orderLine: { id: order.lineId } }],
        },
      ],
      order: {
        status: "PARTIALLY_FULFILLED",
        lines: [{ quantityFulfilled: 1, quantityToFulfill: 1 }],
      },
      errors: [],
    });

    const read = await gql<{ order: { fulfillments: unknown; events: unknown } }>(
      ORDER,
      { id: order.orderId },
      staff.token,
    );
    expect(read.order.fulfillments).toEqual([{ fulfillmentOrder: 1, lines: [{ quantity: 1 }] }]);
    expect(read.order.events).toEqual([
      {
        type: "PLACED",
        user: null,
        amount: null,
        transactionReference: null,
        fulfilledItems: null,
      },
      {
        type: "FULFILLMENT_FULFILLED_ITEMS",
        user: { email: staff.email },
        amount: null,
        transactionReference: null,
        fulfilledItems: [{ quantity: 1, orderLine: { id: order.lineId } }],
      },
    ]);
  });

  it("refund, mark as paid and cancel through the API", async () => {
    const order = await placeOrder();
    const staff = await createStaff(db, ["MANAGE_ORDERS", "HANDLE_PAYMENTS"]);

    expect(
      (await gql<{ orderMarkAsPaid: unknown }>(MARK_AS_PAID, { id: order.orderId }, staff.token))
        .orderMarkAsPaid,
    ).toEqual({
      order: null,
      errors: [
        {
          field: "transaction",
          code: "TRANSACTION_ERROR",
          message: "The order is already fully paid.",
        },
      ],
    });

    expect(
      (
        await gql<{ transactionRequestAction: unknown }>(
          REFUND,
          { token: order.transactionToken, action: "REFUND", amount: "1000" },
          staff.token,
        )
      ).transactionRequestAction,
    ).toEqual({
      transaction: {
        chargedAmount: { amount: 1500 },
        refundedAmount: { amount: 1000 },
        actions: ["REFUND"],
        events: [
          { type: "CHARGE_SUCCESS", amount: { amount: 2500 } },
          { type: "REFUND_REQUEST", amount: { amount: 1000 } },
          { type: "REFUND_SUCCESS", amount: { amount: 1000 } },
        ],
      },
      errors: [],
    });
    expect(
      (await gql<{ order: unknown }>(ORDER, { id: order.orderId }, staff.token)).order,
    ).toMatchObject({
      actions: ["MARK_AS_PAID"],
      chargeStatus: "PARTIAL",
      totalRefunded: { amount: 1000 },
    });

    expect(
      (
        await gql<{ orderMarkAsPaid: unknown }>(
          MARK_AS_PAID,
          { id: order.orderId, ref: " BANK-1 " },
          staff.token,
        )
      ).orderMarkAsPaid,
    ).toEqual({ order: { chargeStatus: "FULL", actions: [] }, errors: [] });

    expect(
      (await gql<{ orderCancel: unknown }>(CANCEL, { id: order.orderId }, staff.token)).orderCancel,
    ).toEqual({ order: { status: "CANCELED" }, errors: [] });
    expect(
      (await gql<{ orderCancel: unknown }>(CANCEL, { id: order.orderId }, staff.token)).orderCancel,
    ).toEqual({ order: null, errors: [{ field: "order", code: "CANNOT_CANCEL_ORDER" }] });

    const events = (
      await gql<{
        order: {
          events: { type: string; amount: number | null; transactionReference: string | null }[];
        };
      }>(ORDER, { id: order.orderId }, staff.token)
    ).order.events.map(({ type, amount, transactionReference }) => [
      type,
      amount,
      transactionReference,
    ]);
    expect(events).toEqual([
      ["PLACED", null, null],
      ["TRANSACTION_REFUND_REQUESTED", 1000, expect.stringMatching(/^dummy-/)],
      ["ORDER_MARKED_AS_PAID", null, "BANK-1"],
      ["CANCELED", null, null],
    ]);
  });

  it("refund argument errors", async () => {
    const order = await placeOrder();
    const staff = await createStaff(db, ["HANDLE_PAYMENTS"]);
    const refund = async (variables: object) =>
      (await gql<{ transactionRequestAction: unknown }>(REFUND, variables, staff.token))
        .transactionRequestAction;

    expect(await refund({ action: "REFUND" })).toMatchObject({
      errors: [{ code: "REQUIRED", field: null }],
    });
    expect(
      await refund({ id: order.transactionId, token: order.transactionToken, action: "REFUND" }),
    ).toMatchObject({ errors: [{ code: "REQUIRED" }] });
    expect(await refund({ id: order.transactionId, action: "CHARGE" })).toMatchObject({
      errors: [{ code: "INVALID", field: "actionType" }],
    });
    expect(
      await refund({ id: order.transactionId, action: "REFUND", amount: "0.5" }),
    ).toMatchObject({
      errors: [{ code: "INVALID", field: "amount" }],
    });
    expect(
      await refund({ token: crypto.randomUUID(), action: "REFUND", amount: "1" }),
    ).toMatchObject({ errors: [{ code: "NOT_FOUND", field: "id" }] });
  });
});
