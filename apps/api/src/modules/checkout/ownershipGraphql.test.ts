import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createSession } from "../identity/index.ts";
import { DUMMY_GATEWAY_ID } from "../payments/index.ts";
import {
  completeCheckout,
  createShippingMethod,
  initializeCheckoutTransaction,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
} from "./index.ts";

// Checkout ownership through the API (PLAN M7.2, Saleor's rules): a logged-in user owns the
// checkouts they create, checkoutCustomerAttach/Detach change the owner, the order goes to the
// owner (or to the active account with the checkout's email), and `me.checkouts` lists the open
// ones. The id stays the secret: anyone holding it can still use the checkout (decision 7).
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
  variantId = toGlobalId("ProductVariant", variant?.id ?? "");
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error("no shipping");
  shippingMethodId = method.shippingMethod.id;
});

afterAll(async () => {
  await closeDb();
});

/** A customer (non-staff) with a session. */
async function createCustomer(email: string, { isActive = true } = {}) {
  const [user] = await db
    .insert(schema.user)
    .values({ email, isActive })
    .returning({ id: schema.user.id });
  if (!user) throw new Error("no user");
  const { token } = await createSession(db, user.id);
  return { id: user.id, email, token };
}

const CREATE = `mutation($input: CheckoutCreateInput!) {
  checkoutCreate(input: $input) { checkout { id email } errors { field code } }
}`;
const ATTACH = `mutation($id: ID!) {
  checkoutCustomerAttach(id: $id) { checkout { id email } errors { field code } }
}`;
const DETACH = `mutation($id: ID!) {
  checkoutCustomerDetach(id: $id) { checkout { id email } errors { field code } }
}`;
const MY_CHECKOUTS = `{ me { checkouts(first: 10) { totalCount edges { node { id } } } } }`;
const MY_ORDERS = `{ me { orders(first: 10) { edges { node { id } } } } }`;

async function create(input: object, token?: string) {
  const { body } = await client.gql(CREATE, { input }, token);
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  const payload = body.data?.checkoutCreate as { checkout: { id: string; email: string | null } };
  return payload.checkout;
}

const ownerOf = async (globalId: string) => {
  const id = Buffer.from(globalId, "base64").toString("utf8").split(":")[1] ?? "";
  const [row] = await db.select().from(schema.checkout).where(eq(schema.checkout.id, id));
  return row?.userId ?? null;
};

/** Makes the checkout ready and completes it; returns the order's global ID. */
async function complete(globalId: string) {
  const id = Buffer.from(globalId, "base64").toString("utf8").split(":")[1] ?? "";
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
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { orderId: toGlobalId("Order", result.order.id), userId: result.order.userId };
}

describe("checkoutCreate by a logged-in user", () => {
  it("makes them the owner with their email unless another is given", async () => {
    const customer = await createCustomer("bat@example.com");
    const lines = [{ variantId, quantity: 1 }];

    const own = await create({ lines }, customer.token);
    expect(own.email).toBe("bat@example.com");
    expect(await ownerOf(own.id)).toBe(customer.id);

    const gift = await create({ lines, email: "friend@example.com" }, customer.token);
    expect(gift.email).toBe("friend@example.com");
    expect(await ownerOf(gift.id)).toBe(customer.id);

    const guest = await create({ lines, email: "guest@example.com" });
    expect(await ownerOf(guest.id)).toBeNull();

    // Anyone holding the id can still read it (Saleor: the id is the secret).
    const { body } = await client.gql(`query($id: ID!) { checkout(id: $id) { id } }`, {
      id: own.id,
    });
    expect(body).toEqual({ data: { checkout: { id: own.id } } });
  });

  it("lists the open checkouts in `me.checkouts` and the order in `me.orders`", async () => {
    const customer = await createCustomer("bat@example.com");
    const other = await createCustomer("other@example.com");
    const first = await create({ lines: [{ variantId, quantity: 1 }] }, customer.token);
    const second = await create({ lines: [{ variantId, quantity: 2 }] }, customer.token);
    await create({ lines: [{ variantId, quantity: 1 }] }, other.token);

    expect((await client.gql(MY_CHECKOUTS, {}, customer.token)).body.data).toEqual({
      me: {
        checkouts: {
          totalCount: 2,
          edges: [{ node: { id: second.id } }, { node: { id: first.id } }],
        },
      },
    });

    const { orderId, userId } = await complete(first.id);
    expect(userId).toBe(customer.id);
    expect((await client.gql(MY_CHECKOUTS, {}, customer.token)).body.data).toEqual({
      me: { checkouts: { totalCount: 1, edges: [{ node: { id: second.id } }] } },
    });
    expect((await client.gql(MY_ORDERS, {}, customer.token)).body.data).toEqual({
      me: { orders: { edges: [{ node: { id: orderId } }] } },
    });
  });

  it("refuses another user's checkouts without MANAGE_CHECKOUTS", async () => {
    // A staff user reaches another user through an order event (the only path before M7.3).
    const customer = await createCustomer("bat@example.com");
    const checkout = await create({ lines: [{ variantId, quantity: 1 }] }, customer.token);
    const { orderId } = await complete(checkout.id);
    const actor = await createStaff(db, ["MANAGE_ORDERS"]);
    await create({ lines: [{ variantId, quantity: 1 }] }, actor.token);
    const orderDbId = Buffer.from(orderId, "base64").toString("utf8").split(":")[1] ?? "";
    await db
      .insert(schema.orderEvent)
      .values({ orderId: orderDbId, type: "CANCELED", userId: actor.id });
    const QUERY = `query($id: ID!) { order(id: $id) { events { user { checkouts(first: 5) { totalCount } } } } }`;

    const orderStaff = await createStaff(db, ["MANAGE_ORDERS"]);
    const denied = await client.gql(QUERY, { id: orderId }, orderStaff.token);
    expectPermissionDenied(denied, ["OWNER", "MANAGE_CHECKOUTS"]);

    const checkoutStaff = await createStaff(db, ["MANAGE_ORDERS", "MANAGE_CHECKOUTS"]);
    expect((await client.gql(QUERY, { id: orderId }, checkoutStaff.token)).body.data).toEqual({
      order: { events: [{ user: null }, { user: { checkouts: { totalCount: 1 } } }] },
    });
  });
});

describe("completion without an owner", () => {
  it("gives the order to the active account with the checkout's email", async () => {
    const customer = await createCustomer("bat@example.com");
    await createCustomer("inactive@example.com", { isActive: false });

    const matched = await create({ lines: [{ variantId, quantity: 1 }], email: "BAT@example.com" });
    expect((await complete(matched.id)).userId).toBe(customer.id);

    const inactive = await create({
      lines: [{ variantId, quantity: 1 }],
      email: "inactive@example.com",
    });
    expect((await complete(inactive.id)).userId).toBeNull();

    const unknown = await create({ lines: [{ variantId, quantity: 1 }], email: "new@example.com" });
    expect((await complete(unknown.id)).userId).toBeNull();
  });
});

describe("checkoutCustomerAttach / checkoutCustomerDetach", () => {
  it("need a logged-in user", async () => {
    const checkout = await create({ lines: [{ variantId, quantity: 1 }], email: "g@example.com" });
    expectPermissionDenied(await client.gql(ATTACH, { id: checkout.id }), ["AUTHENTICATED_USER"]);
    expectPermissionDenied(await client.gql(DETACH, { id: checkout.id }), ["AUTHENTICATED_USER"]);
  });

  it("attach takes an unowned checkout, with the user's email, and never reassigns", async () => {
    const customer = await createCustomer("bat@example.com");
    const other = await createCustomer("other@example.com");
    const checkout = await create({ lines: [{ variantId, quantity: 1 }], email: "g@example.com" });

    expect((await client.gql(ATTACH, { id: checkout.id }, customer.token)).body.data).toEqual({
      checkoutCustomerAttach: {
        checkout: { id: checkout.id, email: "bat@example.com" },
        errors: [],
      },
    });
    expect(await ownerOf(checkout.id)).toBe(customer.id);

    for (const token of [customer.token, other.token]) {
      const { body } = await client.gql(ATTACH, { id: checkout.id }, token);
      expect(body.errors).toEqual([
        expect.objectContaining({
          message: "You cannot reassign a checkout that is already attached to a user.",
          extensions: { exception: { code: "PermissionDenied" } },
        }),
      ]);
    }
    expect(await ownerOf(checkout.id)).toBe(customer.id);
  });

  it("detach is for the owner only", async () => {
    const customer = await createCustomer("bat@example.com");
    const other = await createCustomer("other@example.com");
    const checkout = await create({ lines: [{ variantId, quantity: 1 }] }, customer.token);

    expectPermissionDenied(await client.gql(DETACH, { id: checkout.id }, other.token), ["OWNER"]);
    expect(await ownerOf(checkout.id)).toBe(customer.id);

    expect((await client.gql(DETACH, { id: checkout.id }, customer.token)).body.data).toEqual({
      checkoutCustomerDetach: {
        checkout: { id: checkout.id, email: "bat@example.com" },
        errors: [],
      },
    });
    expect(await ownerOf(checkout.id)).toBeNull();
    // An unowned checkout: anyone logged in may detach (nothing changes).
    expect(
      (await client.gql(DETACH, { id: checkout.id }, other.token)).body.errors,
    ).toBeUndefined();
  });

  it("refuse a completed checkout with Saleor's error", async () => {
    const customer = await createCustomer("bat@example.com");
    const checkout = await create({ lines: [{ variantId, quantity: 1 }], email: "g@example.com" });
    await complete(checkout.id);
    const { body } = await client.gql(ATTACH, { id: checkout.id }, customer.token);
    expect(body.data).toEqual({
      checkoutCustomerAttach: {
        checkout: null,
        errors: [expect.objectContaining({ field: "id" })],
      },
    });
  });
});
