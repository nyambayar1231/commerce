import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createShippingMethod } from "../checkout/index.ts";
import { createSession } from "../identity/index.ts";

// Draft orders through the API (PLAN M13.2): draftOrderCreate/Update/Delete, draftOrders, and
// drafts kept out of the placed orders' lists, the customer's reads and the lifecycle actions.
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

async function gql<T>(query: string, variables: object, token?: string): Promise<T> {
  const { body } = await client.gql(query, variables, token);
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data as T;
}

const ORDER_FIELDS = `
  id number status userEmail user { id } shippingMethodName
  shippingMethod { id name } shippingMethods { id name }
  shippingAddress { firstName city country { code } }
  billingAddress { firstName }
  shippingPrice { gross { amount } } subtotal { gross { amount } } total { gross { amount currency } }
  actions events { type user { id } }`;

const ERRORS = "errors { field code message addressType }";

const CREATE = `mutation($input: DraftOrderCreateInput!) {
  draftOrderCreate(input: $input) { order { ${ORDER_FIELDS} } ${ERRORS} }
}`;
const UPDATE = `mutation($id: ID!, $input: DraftOrderInput!) {
  draftOrderUpdate(id: $id, input: $input) { order { ${ORDER_FIELDS} } ${ERRORS} }
}`;
const DELETE = `mutation($id: ID!) {
  draftOrderDelete(id: $id) { order { id } ${ERRORS} }
}`;
const LISTS = `{
  orders(first: 10) { totalCount edges { node { id } } }
  draftOrders(first: 10) { totalCount edges { node { id status } } }
}`;

type Order = {
  id: string;
  number: string;
  status: string;
  userEmail: string | null;
  user: { id: string } | null;
  shippingMethodName: string | null;
  shippingMethod: { id: string; name: string } | null;
  shippingMethods: { id: string; name: string }[];
  shippingAddress: { firstName: string; city: string; country: { code: string } } | null;
  billingAddress: { firstName: string } | null;
  shippingPrice: { gross: { amount: number } };
  subtotal: { gross: { amount: number } };
  total: { gross: { amount: number; currency: string } };
  actions: string[];
  events: { type: string; user: { id: string } | null }[];
};
type Payload = {
  order: Order | null;
  errors: { field: string | null; code: string; message: string; addressType: string | null }[];
};

const address = {
  firstName: "Bat",
  lastName: "Dorj",
  streetAddress1: "A 1",
  city: "UB",
  country: "MN",
};

async function createDraft(token: string, input: object = {}) {
  const data = await gql<{ draftOrderCreate: Payload }>(CREATE, { input }, token);
  expect(data.draftOrderCreate.errors).toEqual([]);
  const order = data.draftOrderCreate.order;
  if (!order) throw new Error("no draft");
  return order;
}

async function customer(email: string, confirmed = true) {
  const [user] = await db
    .insert(schema.user)
    .values({ email, isConfirmed: confirmed })
    .returning({ id: schema.user.id });
  if (!user) throw new Error("no user");
  const { token } = await createSession(db, user.id);
  return { id: user.id, token };
}

describe("draft orders", () => {
  it("need MANAGE_ORDERS", async () => {
    const other = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);

    expectPermissionDenied(await client.gql(CREATE, { input: {} }), ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(CREATE, { input: {} }, other.token), ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(UPDATE, { id: draft.id, input: {} }, other.token), [
      "MANAGE_ORDERS",
    ]);
    expectPermissionDenied(await client.gql(DELETE, { id: draft.id }, other.token), [
      "MANAGE_ORDERS",
    ]);
    expectPermissionDenied(
      await client.gql("{ draftOrders(first: 1) { totalCount } }", {}, other.token),
      ["MANAGE_ORDERS"],
    );
  });

  it("creates an empty draft that only draftOrders lists", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);

    expect(draft).toMatchObject({
      status: "DRAFT",
      userEmail: null,
      user: null,
      shippingMethodName: null,
      shippingMethod: null,
      shippingAddress: null,
      billingAddress: null,
      total: { gross: { amount: 0, currency: "MNT" } },
      actions: [],
      events: [{ type: "DRAFT_CREATED", user: { id: toGlobalId("User", staff.id) } }],
    });
    expect(Number(draft.number)).toBeGreaterThan(0);

    const lists = await gql<{
      orders: { totalCount: number };
      draftOrders: { totalCount: number; edges: { node: { id: string; status: string } }[] };
    }>(LISTS, {}, staff.token);
    expect(lists.orders.totalCount).toBe(0);
    expect(lists.draftOrders).toEqual({
      totalCount: 1,
      edges: [{ node: { id: draft.id, status: "DRAFT" } }],
    });
  });

  it("sets and clears the customer, addresses and shipping method", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const buyer = await customer("buyer@example.com");
    const method = await createShippingMethod(db, { name: "Express", price: "7000" });
    if (!method.ok) throw new Error("no method");
    const methodId = toGlobalId("ShippingMethod", method.shippingMethod.id);

    // A bare email links the confirmed account that has it (Saleor's draftOrderCreate).
    const draft = await createDraft(staff.token, {
      userEmail: " Buyer@example.com ",
      shippingAddress: address,
      billingAddress: address,
      shippingMethod: methodId,
    });
    expect(draft).toMatchObject({
      userEmail: "Buyer@example.com",
      user: { id: toGlobalId("User", buyer.id) },
      shippingAddress: { firstName: "Bat", city: "UB", country: { code: "MN" } },
      billingAddress: { firstName: "Bat" },
      shippingMethodName: "Express",
      shippingMethod: { id: methodId, name: "Express" },
      shippingMethods: [{ id: methodId, name: "Express" }],
      shippingPrice: { gross: { amount: 7000 } },
      total: { gross: { amount: 7000 } },
    });

    // A left-out field stays; null clears.
    const cleared = await gql<{ draftOrderUpdate: Payload }>(
      UPDATE,
      {
        id: draft.id,
        input: { shippingMethod: null, billingAddress: null, userEmail: "x@example.org" },
      },
      staff.token,
    );
    expect(cleared.draftOrderUpdate.errors).toEqual([]);
    expect(cleared.draftOrderUpdate.order).toMatchObject({
      userEmail: "x@example.org",
      user: null,
      shippingAddress: { firstName: "Bat" },
      billingAddress: null,
      shippingMethod: null,
      shippingMethodName: null,
      total: { gross: { amount: 0 } },
    });

    // `user` sets the account and its email.
    const byUser = await gql<{ draftOrderUpdate: Payload }>(
      UPDATE,
      { id: draft.id, input: { user: toGlobalId("User", buyer.id) } },
      staff.token,
    );
    expect(byUser.draftOrderUpdate.order).toMatchObject({
      userEmail: "buyer@example.com",
      user: { id: toGlobalId("User", buyer.id) },
    });
  });

  it("returns Saleor's errors for bad input and changes nothing", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const inactive = await createShippingMethod(db, { name: "Old", price: "1", isActive: false });
    if (!inactive.ok) throw new Error("no method");
    const draft = await createDraft(staff.token);

    const result = await gql<{ draftOrderUpdate: Payload }>(
      UPDATE,
      {
        id: draft.id,
        input: {
          userEmail: "not-an-email",
          shippingAddress: { ...address, city: "" },
          billingAddress: { ...address, streetAddress1: " " },
          shippingMethod: toGlobalId("ShippingMethod", inactive.shippingMethod.id),
        },
      },
      staff.token,
    );
    expect(result.draftOrderUpdate).toEqual({
      order: null,
      errors: [
        {
          field: "userEmail",
          code: "INVALID",
          message: "Enter a valid email address.",
          addressType: null,
        },
        {
          field: "city",
          code: "REQUIRED",
          message: "This field is required.",
          addressType: "SHIPPING",
        },
        {
          field: "streetAddress1",
          code: "REQUIRED",
          message: "This field is required.",
          addressType: "BILLING",
        },
        {
          field: "shippingMethod",
          code: "SHIPPING_METHOD_NOT_APPLICABLE",
          message: "Shipping method is not applicable.",
          addressType: null,
        },
      ],
    });
    const [row] = await db.select().from(schema.order);
    expect(row).toMatchObject({ userEmail: null, shippingAddress: null, shippingMethodId: null });
  });

  it("deletes a draft with its lines and events, and only a draft", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);

    const deleted = await gql<{ draftOrderDelete: Payload }>(DELETE, { id: draft.id }, staff.token);
    expect(deleted.draftOrderDelete).toEqual({ order: { id: draft.id }, errors: [] });
    expect(await db.select().from(schema.order)).toEqual([]);
    expect(await db.select().from(schema.orderEvent)).toEqual([]);

    const again = await gql<{ draftOrderDelete: Payload }>(DELETE, { id: draft.id }, staff.token);
    expect(again.draftOrderDelete.errors).toEqual([
      { field: "id", code: "NOT_FOUND", message: "Order does not exist.", addressType: null },
    ]);
  });

  it("refuses draft mutations on a placed order", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);
    // A placed order (as checkout completion stores one), made from the draft's row.
    await db.update(schema.order).set({
      status: "UNFULFILLED",
      userEmail: "a@example.com",
      billingAddress: address,
      shippingAddress: address,
      shippingMethodName: "Standard",
    });

    const updated = await gql<{ draftOrderUpdate: Payload }>(
      UPDATE,
      { id: draft.id, input: { userEmail: "b@example.com" } },
      staff.token,
    );
    expect(updated.draftOrderUpdate.errors).toEqual([
      {
        field: "id",
        code: "INVALID",
        message:
          "Provided order id belongs to non-draft order. Use `orderUpdate` mutation instead.",
        addressType: null,
      },
    ]);
    const deleted = await gql<{ draftOrderDelete: Payload }>(DELETE, { id: draft.id }, staff.token);
    expect(deleted.draftOrderDelete.errors).toEqual([
      {
        field: "id",
        code: "INVALID",
        message: "Provided order id belongs to non-draft order.",
        addressType: null,
      },
    ]);
  });

  it("can't be fulfilled, canceled or marked as paid", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);

    const data = await gql<{
      orderFulfill: { errors: { code: string; message: string }[] };
      orderCancel: { errors: { code: string; message: string }[] };
      orderMarkAsPaid: { errors: { code: string; message: string }[] };
    }>(
      `mutation($id: ID!) {
        orderFulfill(order: $id, input: { lines: [] }) { errors { code message } }
        orderCancel(id: $id) { errors { code message } }
        orderMarkAsPaid(id: $id) { errors { code message } }
      }`,
      { id: draft.id },
      staff.token,
    );
    expect(data.orderFulfill.errors).toEqual([
      { code: "INVALID", message: "Can't fulfill a draft order." },
    ]);
    expect(data.orderCancel.errors).toEqual([
      { code: "CANNOT_CANCEL_ORDER", message: "This order can't be canceled." },
    ]);
    expect(data.orderMarkAsPaid.errors).toEqual([
      { code: "INVALID", message: "Can't mark a draft order as paid." },
    ]);
  });

  it("is hidden from the customer it belongs to", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const buyer = await customer("buyer@example.com");
    const draft = await createDraft(staff.token, { user: toGlobalId("User", buyer.id) });

    const { body } = await client.gql(
      "query($id: ID!) { order(id: $id) { id } me { orders(first: 5) { totalCount } } }",
      { id: draft.id },
      buyer.token,
    );
    expect(body.data).toEqual({ order: null, me: { orders: { totalCount: 0 } } });
    expect(body.errors?.[0]?.extensions).toEqual({ exception: { code: "PermissionDenied" } });
  });

  it("is the only order the database lets go without customer, addresses or shipping", async () => {
    await expect(
      db.insert(schema.order).values({
        status: "UNFULFILLED",
        shippingPriceAmount: 0,
        subtotalAmount: 0,
        totalAmount: 0,
        currency: "MNT",
      }),
    ).rejects.toMatchObject({ cause: { constraint_name: "order_complete_unless_draft" } });
  });
});
