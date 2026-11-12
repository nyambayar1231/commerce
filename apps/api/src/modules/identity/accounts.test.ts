import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
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
import { DUMMY_GATEWAY_ID } from "../payments/index.ts";

// Customer accounts through the API (PLAN M7.1): accountRegister (active at once, no account
// enumeration, guest orders linked), login as a customer, `me.orders`, and who may read an order.
const db = getDb();
const client = createTestClient(db);
let variantId: string;
let shippingMethodId: string;

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, "order", checkout, product, shipping_method, allocation, payment_transaction CASCADE',
  );
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: "boots", isPublished: true })
    .returning();
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product?.id ?? "",
      name: "42",
      sku: "B-42",
      priceAmount: 1000,
      currency: "MNT",
      trackInventory: false,
    })
    .returning();
  variantId = variant?.id ?? "";
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error("no shipping");
  shippingMethodId = method.shippingMethod.id;
});

afterAll(async () => {
  await closeDb();
});

/** A paid guest order placed with `email`; returns its global ID. */
async function placeGuestOrder(email: string) {
  const created = await createCheckout(db, { lines: [{ variantId, quantity: 1 }], email });
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
  await updateCheckoutDeliveryMethod(db, id, shippingMethodId);
  await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
  const result = await completeCheckout(db, id);
  if (!result.ok) throw new Error("not placed");
  return toGlobalId("Order", result.order.id);
}

const REGISTER = `mutation($input: AccountRegisterInput!) {
  accountRegister(input: $input) { requiresConfirmation errors { field code message } }
}`;
const LOGIN = `mutation($email: String!, $password: String!) {
  tokenCreate(email: $email, password: $password) { user { email isStaff firstName } errors { code } }
}`;
const MY_ORDERS = `query($first: Int, $after: String) {
  me { email orders(first: $first, after: $after) {
    totalCount edges { node { id userEmail } } pageInfo { hasNextPage endCursor }
  } }
}`;
const ORDER = `query($id: ID!) { order(id: $id) { id userEmail } }`;
const ORDER_USER = `query($id: ID!) { order(id: $id) { user { email } } }`;
const ORDER_EVENTS = `query($id: ID!) { order(id: $id) { id events { type } } }`;

const register = async (input: object) =>
  (await client.gql(REGISTER, { input })).body.data?.accountRegister;

/** Logs in and returns the session token from the cookie (as auth.test.ts). */
async function login(email: string, password: string) {
  const { response, body } = await client.gql(LOGIN, { email, password });
  const token = /^session=([^;]+);/.exec(response.headers.get("set-cookie") ?? "")?.[1] ?? null;
  return { token, payload: body.data?.tokenCreate };
}

describe("accountRegister", () => {
  it("creates an active customer who can log in at once", async () => {
    expect(
      await register({
        email: " Bat@Example.com ",
        password: "correct horse",
        firstName: " Bat ",
        lastName: "Dorj",
      }),
    ).toEqual({ requiresConfirmation: false, errors: [] });

    const [user] = await db.select().from(schema.user);
    expect(user).toMatchObject({
      email: "bat@example.com",
      firstName: "Bat",
      lastName: "Dorj",
      isStaff: false,
      isSuperuser: false,
      isActive: true,
    });
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);

    const { token, payload } = await login("bat@example.com", "correct horse");
    expect(payload).toEqual({
      user: { email: "bat@example.com", isStaff: false, firstName: "Bat" },
      errors: [],
    });
    expect(token).not.toBeNull();
  });

  it("answers an existing email like a new one and changes nothing", async () => {
    await register({ email: "bat@example.com", password: "first password" });
    expect(await register({ email: "BAT@example.com", password: "second password" })).toEqual({
      requiresConfirmation: false,
      errors: [],
    });

    expect(await db.select().from(schema.user)).toHaveLength(1);
    expect((await login("bat@example.com", "second password")).token).toBeNull();
    expect((await login("bat@example.com", "first password")).token).not.toBeNull();
  });

  it("creates one account when the same email registers twice at once", async () => {
    const results = await Promise.all([
      register({ email: "race@example.com", password: "password one" }),
      register({ email: "race@example.com", password: "password two" }),
    ]);
    expect(results).toEqual([
      { requiresConfirmation: false, errors: [] },
      { requiresConfirmation: false, errors: [] },
    ]);
    expect(await db.select().from(schema.user)).toHaveLength(1);
  });

  it("reports Saleor's validation errors", async () => {
    expect(await register({ email: " ", password: "short" })).toEqual({
      requiresConfirmation: false,
      errors: [
        { field: "email", code: "REQUIRED", message: "This field is required." },
        {
          field: "password",
          code: "PASSWORD_TOO_SHORT",
          message: "This password is too short. It must contain at least 8 characters.",
        },
      ],
    });
    expect(await register({ email: "not-an-email", password: "x".repeat(129) })).toEqual({
      requiresConfirmation: false,
      errors: [
        { field: "email", code: "INVALID", message: "Enter a valid email address." },
        {
          field: "password",
          code: "INVALID",
          message: "Ensure this value has at most 128 characters.",
        },
      ],
    });
    expect(await db.select().from(schema.user)).toHaveLength(0);
  });

  it("links the email's guest orders, not other people's", async () => {
    const mine = await placeGuestOrder("Buyer@Example.com");
    const someoneElses = await placeGuestOrder("other@example.com");
    // An order with the email that already belongs to an account stays with it.
    const owned = await placeGuestOrder("buyer@example.com");
    const [owner] = await db
      .insert(schema.user)
      .values({ email: "previous@example.com" })
      .returning();
    await db
      .update(schema.order)
      .set({ userId: owner?.id ?? null })
      .where(eq(schema.order.id, (await orderRow(owned)).id));

    await register({ email: "buyer@example.com", password: "buyer password" });
    const { token } = await login("buyer@example.com", "buyer password");
    const { body } = await client.gql(MY_ORDERS, { first: 10 }, token ?? "");
    expect(body.errors).toBeUndefined();
    expect(body.data?.me).toEqual({
      email: "buyer@example.com",
      orders: {
        totalCount: 1,
        edges: [{ node: { id: mine, userEmail: "Buyer@Example.com" } }],
        pageInfo: { hasNextPage: false, endCursor: expect.any(String) },
      },
    });
    expect((await orderRow(someoneElses)).userId).toBeNull();
    expect((await orderRow(owned)).userId).toBe(owner?.id);
  });
});

async function orderRow(globalId: string) {
  const id = Buffer.from(globalId, "base64").toString("utf8").split(":")[1] ?? "";
  const [row] = await db.select().from(schema.order).where(eq(schema.order.id, id));
  if (!row) throw new Error("no order");
  return row;
}

describe("customer order reads", () => {
  it("pages `me.orders` newest first", async () => {
    const first = await placeGuestOrder("pager@example.com");
    const second = await placeGuestOrder("pager@example.com");
    const third = await placeGuestOrder("pager@example.com");
    await register({ email: "pager@example.com", password: "pager password" });
    const { token } = await login("pager@example.com", "pager password");

    const page1 = (await client.gql(MY_ORDERS, { first: 2 }, token ?? "")).body.data?.me as {
      orders: { edges: { node: { id: string } }[]; pageInfo: { endCursor: string } };
    };
    expect(page1.orders.edges.map((edge) => edge.node.id)).toEqual([third, second]);
    const page2 = (
      await client.gql(MY_ORDERS, { first: 2, after: page1.orders.pageInfo.endCursor }, token ?? "")
    ).body.data?.me as { orders: { edges: { node: { id: string } }[] } };
    expect(page2.orders.edges.map((edge) => edge.node.id)).toEqual([first]);
  });

  it("lets the owner read their order but not its history; others need MANAGE_ORDERS", async () => {
    const order = await placeGuestOrder("owner@example.com");
    const guestOrder = await placeGuestOrder("guest@example.com");
    await register({ email: "owner@example.com", password: "owner password" });
    await register({ email: "nosy@example.com", password: "nosy password" });
    const owner = (await login("owner@example.com", "owner password")).token ?? "";
    const nosy = (await login("nosy@example.com", "nosy password")).token ?? "";
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);

    expect((await client.gql(ORDER, { id: order }, owner)).body).toEqual({
      data: { order: { id: order, userEmail: "owner@example.com" } },
    });
    const history = await client.gql(ORDER_EVENTS, { id: order }, owner);
    expect(history.body.data).toEqual({ order: { id: order, events: null } });
    expectPermissionDenied(history, ["MANAGE_ORDERS"]);

    expectPermissionDenied(await client.gql(ORDER, { id: order }, nosy), ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(ORDER, { id: guestOrder }, owner), ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(ORDER, { id: order }), ["MANAGE_ORDERS"]);
    // An unknown id is refused the same way, so ids can't be probed.
    expectPermissionDenied(
      await client.gql(ORDER, { id: toGlobalId("Order", crypto.randomUUID()) }, nosy),
      ["MANAGE_ORDERS"],
    );

    // Order.user: the owner and order staff see who placed it.
    for (const token of [owner, staff.token]) {
      expect((await client.gql(ORDER_USER, { id: order }, token)).body).toEqual({
        data: { order: { user: { email: "owner@example.com" } } },
      });
    }

    expect((await client.gql(ORDER_EVENTS, { id: order }, staff.token)).body).toEqual({
      data: { order: { id: order, events: [{ type: "PLACED" }] } },
    });
  });

  it("filters `me.orders` by status", async () => {
    await placeGuestOrder("filter@example.com");
    const cancelled = await placeGuestOrder("filter@example.com");
    await db
      .update(schema.order)
      .set({ status: "CANCELED" })
      .where(eq(schema.order.id, (await orderRow(cancelled)).id));
    await register({ email: "filter@example.com", password: "filter password" });
    const { token } = await login("filter@example.com", "filter password");
    const count = async (status: object) => {
      const { body } = await client.gql(
        `query($where: CustomerOrderWhereInput) { me { orders(where: $where) { totalCount } } }`,
        { where: { status } },
        token ?? "",
      );
      const me = body.data?.me as { orders: { totalCount: number } } | undefined;
      return me?.orders.totalCount;
    };

    expect(await count({ oneOf: ["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED"] })).toBe(1);
    expect(await count({ eq: "CANCELED" })).toBe(1);
  });

  it("lets MANAGE_ORDERS staff page another user's orders", async () => {
    // A staff user reaches another user through an order event (the only path before M7.3).
    const order = await placeGuestOrder("buyer@example.com");
    const actor = await createStaff(db, ["MANAGE_ORDERS"]);
    await db.insert(schema.orderEvent).values({
      orderId: (await orderRow(order)).id,
      type: "CANCELED",
      userId: actor.id,
    });
    const EVENT_USER_ORDERS = `query($id: ID!) { order(id: $id) { events { user { email orders(first: 5) { totalCount } } } } }`;

    const reader = await createStaff(db, ["MANAGE_ORDERS"]);
    expect((await client.gql(EVENT_USER_ORDERS, { id: order }, reader.token)).body).toEqual({
      data: {
        order: {
          events: [{ user: null }, { user: { email: actor.email, orders: { totalCount: 0 } } }],
        },
      },
    });
  });
});
