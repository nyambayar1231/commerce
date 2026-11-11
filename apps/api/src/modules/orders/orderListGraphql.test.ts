import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";

// The staff `orders` query and the order payment fields through the app (M6.1).
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, "order", checkout, payment_transaction CASCADE',
  );
});

afterAll(async () => {
  await closeDb();
});

const ADDRESS = { firstName: "A", lastName: "B", streetAddress1: "C", city: "D", country: "MN" };

async function seedOrder(
  email: string,
  status: "UNFULFILLED" | "CANCELED",
  charged: number,
  eventUserId: string | null,
) {
  const [order] = await db
    .insert(schema.order)
    .values({
      status,
      userEmail: email,
      billingAddress: ADDRESS,
      shippingAddress: ADDRESS,
      shippingMethodName: "Standard",
      shippingPriceAmount: 0,
      subtotalAmount: 1000,
      totalAmount: 1000,
      currency: "MNT",
    })
    .returning();
  if (!order) throw new Error("no order");
  await db
    .insert(schema.orderEvent)
    .values({ orderId: order.id, type: "PLACED", userId: eventUserId });
  if (charged > 0) {
    await db.insert(schema.paymentTransaction).values({
      orderId: order.id,
      provider: "manual",
      name: "Manual",
      currency: "MNT",
      chargedAmount: charged,
      refundedAmount: 100,
      idempotencyKey: crypto.randomUUID(),
    });
  }
  return order;
}

const ORDERS = `query($where: OrderWhereInput, $sort: OrderSortingInput, $search: String) {
  orders(first: 10, where: $where, sortBy: $sort, search: $search) {
    totalCount
    edges { node {
      number userEmail status chargeStatus authorizeStatus
      totalCharged { amount } totalRefunded { amount } totalChargePending { amount } totalBalance { amount }
      events { type user { email } }
    } }
    pageInfo { hasNextPage hasPreviousPage }
  }
}`;

type OrdersData = {
  orders: {
    totalCount: number;
    edges: { node: Record<string, unknown> }[];
    pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
  };
};

describe("orders", () => {
  it("lists, filters and sorts orders with their payment fields for MANAGE_ORDERS", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const [user] = await db.select().from(schema.user);
    await seedOrder("paid@example.com", "UNFULFILLED", 1100, user?.id ?? null);
    await seedOrder("canceled@example.com", "CANCELED", 0, null);

    const { body } = await client.gql(
      ORDERS,
      { where: { status: { eq: "UNFULFILLED" } }, sort: { field: "CUSTOMER", direction: "ASC" } },
      staff.token,
    );
    expect(body.errors).toBeUndefined();
    const data = body.data as OrdersData;
    expect(data.orders.totalCount).toBe(1);
    expect(data.orders.edges[0]?.node).toEqual({
      number: expect.stringMatching(/^\d+$/),
      userEmail: "paid@example.com",
      status: "UNFULFILLED",
      chargeStatus: "FULL",
      authorizeStatus: "FULL",
      totalCharged: { amount: 1000 },
      totalRefunded: { amount: 100 },
      totalChargePending: { amount: 0 },
      totalBalance: { amount: 0 },
      events: [{ type: "PLACED", user: { email: user?.email } }],
    });

    const searched = await client.gql(ORDERS, { search: "canceled" }, staff.token);
    expect((searched.body.data as OrdersData).orders.edges.map((edge) => edge.node.status)).toEqual(
      ["CANCELED"],
    );
  });

  it("denies callers without MANAGE_ORDERS", async () => {
    const other = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expectPermissionDenied(await client.gql(ORDERS, {}, other.token), ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(ORDERS, {}), ["MANAGE_ORDERS"]);
  });
});
