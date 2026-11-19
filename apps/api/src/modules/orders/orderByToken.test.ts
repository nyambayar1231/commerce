import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { decodeGlobalId, toGlobalId } from "../../graphql/globalId.ts";
import { addDraftOrderLines, completeDraftOrder, createDraftOrder, getOrder } from "./index.ts";

// A guest's way back to their order without staff credentials (M15.3, Saleor's Order.token and
// orderByToken): the whole journey through the app, anonymously, then the token lookup.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, "order", checkout, product, shipping_method, allocation, payment_transaction, fulfillment CASCADE',
  );
});

afterAll(async () => {
  await closeDb();
});

async function gql<T>(query: string, variables: object = {}, token?: string): Promise<T> {
  const { body } = await client.gql(query, variables, token);
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data as T;
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ORDER_BY_TOKEN = `query($token: UUID!) {
  orderByToken(token: $token) {
    id token number status userEmail
    total { gross { amount currency } }
    lines { productName quantity totalPrice { gross { amount } } }
  }
}`;

type OrderByToken = {
  orderByToken: {
    id: string;
    token: string;
    number: string;
    status: string;
    userEmail: string | null;
    total: { gross: { amount: number; currency: string } };
    lines: { productName: string; quantity: number; totalPrice: { gross: { amount: number } } }[];
  } | null;
};

describe("orderByToken", () => {
  it("gives every order its own random token, with the migration's per-row default", async () => {
    const [first] = await db
      .insert(schema.order)
      .values({
        status: "UNFULFILLED",
        userEmail: "a@example.com",
        shippingPriceAmount: 0,
        subtotalAmount: 1000,
        totalAmount: 1000,
        currency: "MNT",
      })
      .returning();
    const [second] = await db
      .insert(schema.order)
      .values({
        status: "UNFULFILLED",
        userEmail: "b@example.com",
        shippingPriceAmount: 0,
        subtotalAmount: 2000,
        totalAmount: 2000,
        currency: "MNT",
      })
      .returning();
    expect(first?.token).toMatch(UUID_LIKE);
    expect(second?.token).toMatch(UUID_LIKE);
    expect(first?.token).not.toBe(second?.token);

    const [column] = (await db.$client.unsafe(
      `select column_default from information_schema.columns
        where table_name = 'order' and column_name = 'token'`,
    )) as { column_default: string | null }[];
    expect(column?.column_default).toContain("gen_random_uuid()");
  });

  it("returns the guest's order anonymously after checkoutComplete, but not its events", async () => {
    const [warehouse] = await db.select().from(schema.warehouse);
    const [product] = await db
      .insert(schema.product)
      .values({ name: "Boots", slug: "boots", isPublished: true })
      .returning();
    const [variant] = await db
      .insert(schema.productVariant)
      .values({
        productId: product?.id ?? "",
        name: "42",
        sku: "BOOTS-42",
        priceAmount: 1000,
        currency: "MNT",
      })
      .returning();
    await db
      .insert(schema.stock)
      .values({ warehouseId: warehouse?.id ?? "", variantId: variant?.id ?? "", quantity: 3 });
    const variantId = toGlobalId("ProductVariant", variant?.id ?? "");

    const staff = await createStaff(db, ["MANAGE_SHIPPING", "MANAGE_ORDERS"]);
    const method = await gql<{ shippingPriceCreate: { shippingMethod: { id: string } } }>(
      `mutation { shippingPriceCreate(input: { name: "Standard", price: "500" }) { shippingMethod { id } } }`,
      {},
      staff.token,
    );
    const methodPk = decodeGlobalId(method.shippingPriceCreate.shippingMethod.id).id;

    const created = await gql<{ checkoutCreate: { checkout: { id: string } } }>(
      `mutation($input: CheckoutCreateInput!) { checkoutCreate(input: $input) { checkout { id } } }`,
      { input: { email: "buyer@example.com", lines: [{ variantId, quantity: 2 }] } },
    );
    const checkoutId = created.checkoutCreate.checkout.id;
    const address = {
      firstName: "Bat",
      lastName: "Dorj",
      streetAddress1: "Peace Ave 1",
      city: "Ulaanbaatar",
      country: "MN",
    };
    await gql(
      `mutation($id: ID!, $a: AddressInput!, $m: ID) {
        s: checkoutShippingAddressUpdate(id: $id, shippingAddress: $a) { errors { code } }
        b: checkoutBillingAddressUpdate(id: $id, billingAddress: $a) { errors { code } }
        d: checkoutDeliveryMethodUpdate(id: $id, deliveryMethodId: $m) { errors { code } }
      }`,
      { id: checkoutId, a: address, m: toGlobalId("ShippingMethod", methodPk) },
    );
    await gql(
      `mutation($id: ID!) {
        transactionInitialize(id: $id, paymentGateway: { id: "saleor.io.dummy-payment-app" }) { errors { code } }
      }`,
      { id: checkoutId },
    );

    const placed = await gql<{
      checkoutComplete: { order: { id: string; token: string; number: string } | null };
    }>(
      `mutation($id: ID!) { checkoutComplete(id: $id) { order { id token number } errors { code } } }`,
      { id: checkoutId },
    );
    const order = placed.checkoutComplete.order;
    if (!order) throw new Error("the checkout did not complete");
    expect(order.token).toMatch(UUID_LIKE);

    // The token is the only credential: no session, no permission.
    const guest = await gql<OrderByToken>(ORDER_BY_TOKEN, { token: order.token });
    expect(guest.orderByToken).toMatchObject({
      id: order.id,
      token: order.token,
      number: order.number,
      status: "UNFULFILLED",
      userEmail: "buyer@example.com",
      total: { gross: { amount: 2500, currency: "MNT" } },
      lines: [
        {
          productName: "Boots",
          quantity: 2,
          totalPrice: { gross: { amount: 2000 } },
        },
      ],
    });

    // The token opens the order, not its staff-only history (Saleor's Order.events).
    expectPermissionDenied(
      await client.gql(`query($t: UUID!) { orderByToken(token: $t) { events { type } } }`, {
        t: order.token,
      }),
      ["MANAGE_ORDERS"],
    );
    expect(
      (
        await gql<{ orderByToken: { events: { type: string }[] } }>(
          `query($t: UUID!) { orderByToken(token: $t) { events { type } } }`,
          { t: order.token },
          staff.token,
        )
      ).orderByToken.events,
    ).toEqual([{ type: "PLACED" }]);
  });

  it("returns null for an unknown token", async () => {
    const data = await gql<OrderByToken>(ORDER_BY_TOKEN, { token: crypto.randomUUID() });
    expect(data.orderByToken).toBeNull();
  });

  it("rejects a malformed token as a GraphQL validation error, before any SQL runs", async () => {
    // The UUID scalar checks the format (M15.3), so graphql-js refuses the variable before the
    // resolver: no query reaches Postgres, and the server logs no unexpected error.
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { response, body } = await client.gql(ORDER_BY_TOKEN, { token: "not-a-uuid" });
      // A request error (the variable fails coercion), so the GraphQL-over-HTTP status is 400.
      expect(response.status).toBe(400);
      expect(body.errors).toEqual([
        expect.objectContaining({
          message: 'Variable "$token" has invalid value: not-a-uuid is not a valid UUID.',
        }),
      ]);
      // Not masked: no `unexpected` extension, and no `data` key (the request failed early).
      expect(body.errors?.[0]?.extensions).toBeUndefined();
      expect(body.data ?? null).toBeNull();
      expect(logged).not.toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });

  it("never returns a draft, and returns it once the draft is completed", async () => {
    const [product] = await db
      .insert(schema.product)
      .values({ name: "Shirt", slug: "shirt", isPublished: true })
      .returning();
    const [variant] = await db
      .insert(schema.productVariant)
      .values({
        productId: product?.id ?? "",
        name: "M",
        sku: "SHIRT-M",
        priceAmount: 1000,
        currency: "MNT",
        // Untracked, so completing the draft needs no warehouse stock (M13.4's check).
        trackInventory: false,
      })
      .returning();

    const draft = await createDraftOrder(db, {
      staffUserId: null,
      draft: { customer: { userId: null, email: "draft@example.com" } },
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.token).toMatch(UUID_LIKE);
    const added = await addDraftOrderLines(db, {
      orderId: draft.id,
      userId: null,
      lines: [{ variantId: variant?.id ?? "", quantity: 1 }],
    });
    if (!added.ok) throw new Error(JSON.stringify(added.errors));

    expect(
      (await gql<OrderByToken>(ORDER_BY_TOKEN, { token: draft.token })).orderByToken,
    ).toBeNull();

    const completed = await completeDraftOrder(db, {
      orderId: draft.id,
      userId: null,
      shippingMethod: null,
    });
    if (!completed.ok) throw new Error(JSON.stringify(completed.errors));
    expect(completed.order.token).toBe(draft.token);
    expect((await getOrder(db, draft.id))?.status).toBe("UNFULFILLED");

    const guest = await gql<OrderByToken>(ORDER_BY_TOKEN, { token: draft.token });
    expect(guest.orderByToken).toMatchObject({
      id: toGlobalId("Order", draft.id),
      token: draft.token,
      status: "UNFULFILLED",
      userEmail: "draft@example.com",
      total: { gross: { amount: 1000, currency: "MNT" } },
    });
  });
});
