import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
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

const LINES_CREATE = `mutation($id: ID!, $input: [OrderLineCreateInput!]!) {
  orderLinesCreate(id: $id, input: $input) {
    order { subtotal { gross { amount } } total { gross { amount } } lines { id quantity } }
    orderLines { id productName variantName productSku quantity unitPrice { gross { amount } } totalPrice { gross { amount } } }
    errors { field code message variants }
  }
}`;
const LINE_UPDATE = `mutation($id: ID!, $quantity: Int!) {
  orderLineUpdate(id: $id, input: { quantity: $quantity }) {
    order { total { gross { amount } } }
    orderLine { id quantity unitPrice { gross { amount } } totalPrice { gross { amount } } }
    errors { field code message }
  }
}`;
const LINE_DELETE = `mutation($id: ID!) {
  orderLineDelete(id: $id) {
    order { total { gross { amount } } lines { id } }
    orderLine { id productName }
    errors { field code message }
  }
}`;
const HISTORY = `query($id: ID!) {
  order(id: $id) { events { type lines { itemName quantity orderLine { id } } } }
}`;

type Line = {
  id: string;
  productName: string;
  variantName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: { gross: { amount: number } };
  totalPrice: { gross: { amount: number } };
};
type LinesPayload = {
  order: {
    subtotal: { gross: { amount: number } };
    total: { gross: { amount: number } };
    lines: { id: string; quantity: number }[];
  } | null;
  orderLines: Line[] | null;
  errors: { field: string | null; code: string; message: string; variants: string[] | null }[];
};

/** A product with one variant at `price` MNT; returns the variant's global ID and row id. */
async function variant(name: string, price: number, published = true) {
  const [product] = await db
    .insert(schema.product)
    .values({ name, slug: `p-${crypto.randomUUID()}`, isPublished: published })
    .returning();
  const [row] = await db
    .insert(schema.productVariant)
    .values({
      productId: product?.id ?? "",
      name: "M",
      sku: `${name}-SKU`,
      priceAmount: price,
      currency: "MNT",
    })
    .returning();
  if (!row) throw new Error("no variant");
  return { id: toGlobalId("ProductVariant", row.id), rowId: row.id };
}

describe("draft order lines", () => {
  it("need MANAGE_ORDERS", async () => {
    const other = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);
    expectPermissionDenied(
      await client.gql(LINES_CREATE, { id: draft.id, input: [] }, other.token),
      ["MANAGE_ORDERS"],
    );
  });

  it("adds lines, merging a variant onto its line, and records the products added", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const shirt = await variant("Shirt", 1000);
    const hat = await variant("Hat", 300);
    const draft = await createDraft(staff.token);

    const first = await gql<{ orderLinesCreate: LinesPayload }>(
      LINES_CREATE,
      {
        id: draft.id,
        input: [
          { variantId: shirt.id, quantity: 1 },
          { variantId: hat.id, quantity: 2 },
          { variantId: shirt.id, quantity: 2 },
        ],
      },
      staff.token,
    );
    expect(first.orderLinesCreate.errors).toEqual([]);
    expect(first.orderLinesCreate.orderLines).toEqual([
      expect.objectContaining({
        productName: "Shirt",
        variantName: "M",
        productSku: "Shirt-SKU",
        quantity: 3,
        unitPrice: { gross: { amount: 1000 } },
        totalPrice: { gross: { amount: 3000 } },
      }),
      expect.objectContaining({
        productName: "Hat",
        quantity: 2,
        totalPrice: { gross: { amount: 600 } },
      }),
    ]);
    expect(first.orderLinesCreate.order).toMatchObject({
      subtotal: { gross: { amount: 3600 } },
      total: { gross: { amount: 3600 } },
    });

    // The shirt again adds to its line; forceNewLine makes a second one.
    const second = await gql<{ orderLinesCreate: LinesPayload }>(
      LINES_CREATE,
      {
        id: draft.id,
        input: [
          { variantId: shirt.id, quantity: 1 },
          { variantId: hat.id, quantity: 1, forceNewLine: true },
        ],
      },
      staff.token,
    );
    expect(second.orderLinesCreate.order?.lines.map((line) => line.quantity).sort()).toEqual([
      1, 2, 4,
    ]);
    expect(second.orderLinesCreate.order?.total).toEqual({ gross: { amount: 4900 } });

    const history = await gql<{
      order: { events: { type: string; lines: { itemName: string; quantity: number }[] | null }[] };
    }>(HISTORY, { id: draft.id }, staff.token);
    expect(history.order.events.map((event) => [event.type, event.lines])).toEqual([
      ["DRAFT_CREATED", null],
      [
        "ADDED_PRODUCTS",
        [
          { itemName: "Shirt (M)", quantity: 3, orderLine: expect.anything() },
          { itemName: "Hat (M)", quantity: 2, orderLine: expect.anything() },
        ],
      ],
      [
        "ADDED_PRODUCTS",
        [
          { itemName: "Shirt (M)", quantity: 1, orderLine: expect.anything() },
          { itemName: "Hat (M)", quantity: 1, orderLine: expect.anything() },
        ],
      ],
    ]);
  });

  it("changes and removes lines at the catalog's current price", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const shirt = await variant("Shirt", 1000);
    const draft = await createDraft(staff.token);
    const added = await gql<{ orderLinesCreate: LinesPayload }>(
      LINES_CREATE,
      { id: draft.id, input: [{ variantId: shirt.id, quantity: 2 }] },
      staff.token,
    );
    const lineId = added.orderLinesCreate.orderLines?.[0]?.id ?? "";

    // The catalog price changes; the draft follows it on its next change (PLAN M13 decision 2).
    await db.update(schema.productVariant).set({ priceAmount: 1500 });
    const updated = await gql<{ orderLineUpdate: LinesPayload & { orderLine: Line } }>(
      LINE_UPDATE,
      { id: lineId, quantity: 1 },
      staff.token,
    );
    expect(updated.orderLineUpdate).toMatchObject({
      errors: [],
      order: { total: { gross: { amount: 1500 } } },
      orderLine: { quantity: 1, unitPrice: { gross: { amount: 1500 } } },
    });

    const deleted = await gql<{ orderLineDelete: LinesPayload & { orderLine: Line } }>(
      LINE_DELETE,
      { id: lineId },
      staff.token,
    );
    expect(deleted.orderLineDelete).toMatchObject({
      errors: [],
      order: { total: { gross: { amount: 0 } }, lines: [] },
      orderLine: { id: lineId, productName: "Shirt" },
    });

    const history = await gql<{
      order: {
        events: {
          type: string;
          lines: { itemName: string; quantity: number; orderLine: unknown }[] | null;
        }[];
      };
    }>(HISTORY, { id: draft.id }, staff.token);
    expect(history.order.events.slice(2)).toEqual([
      {
        type: "REMOVED_PRODUCTS",
        lines: [{ itemName: "Shirt (M)", quantity: 1, orderLine: null }],
      },
      {
        type: "REMOVED_PRODUCTS",
        lines: [{ itemName: "Shirt (M)", quantity: 1, orderLine: null }],
      },
    ]);
  });

  it("returns Saleor's errors", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const shirt = await variant("Shirt", 1000);
    const hidden = await variant("Hidden", 1000, false);
    const draft = await createDraft(staff.token);
    const add = async (input: object[], id = draft.id) =>
      (await gql<{ orderLinesCreate: LinesPayload }>(LINES_CREATE, { id, input }, staff.token))
        .orderLinesCreate.errors;

    expect(await add([{ variantId: shirt.id, quantity: 0 }])).toEqual([
      {
        field: "quantity",
        code: "ZERO_QUANTITY",
        message: "Variants quantity must be greater than 0.",
        variants: [shirt.id],
      },
    ]);
    expect(await add([{ variantId: hidden.id, quantity: 1 }])).toEqual([
      {
        field: "lines",
        code: "PRODUCT_NOT_PUBLISHED",
        message:
          "Can't add product variant that are not published in the channel associated with this draft order.",
        variants: [hidden.id],
      },
    ]);
    const unknown = toGlobalId("ProductVariant", crypto.randomUUID());
    expect(await add([{ variantId: unknown, quantity: 1 }])).toEqual([
      {
        field: "variantId",
        code: "NOT_FOUND",
        message: "Product variant does not exist.",
        variants: [unknown],
      },
    ]);
    expect(await add([{ variantId: shirt.id, quantity: 10_001 }])).toEqual([
      {
        field: "quantity",
        code: "INVALID_QUANTITY",
        message: "A line can hold at most 10000 items.",
        variants: null,
      },
    ]);

    const added = await gql<{ orderLinesCreate: LinesPayload }>(
      LINES_CREATE,
      { id: draft.id, input: [{ variantId: shirt.id, quantity: 1 }] },
      staff.token,
    );
    const lineId = added.orderLinesCreate.orderLines?.[0]?.id ?? "";
    const update = await gql<{ orderLineUpdate: LinesPayload }>(
      LINE_UPDATE,
      { id: lineId, quantity: 0 },
      staff.token,
    );
    expect(update.orderLineUpdate.errors).toEqual([
      { field: "quantity", code: "ZERO_QUANTITY", message: "Ensure this value is greater than 0." },
    ]);

    // A placed order's lines can't be edited.
    await db.update(schema.order).set({
      status: "UNFULFILLED",
      userEmail: "a@example.com",
      billingAddress: address,
      shippingAddress: address,
      shippingMethodName: "Standard",
    });
    const notEditable = {
      field: "id",
      code: "NOT_EDITABLE",
      message: "Only draft and unconfirmed orders can be edited.",
    };
    expect(await add([{ variantId: shirt.id, quantity: 1 }])).toEqual([
      { ...notEditable, variants: null },
    ]);
    const updatePlaced = await gql<{ orderLineUpdate: LinesPayload }>(
      LINE_UPDATE,
      { id: lineId, quantity: 2 },
      staff.token,
    );
    expect(updatePlaced.orderLineUpdate.errors).toEqual([notEditable]);
    const deletePlaced = await gql<{ orderLineDelete: LinesPayload }>(
      LINE_DELETE,
      { id: lineId },
      staff.token,
    );
    expect(deletePlaced.orderLineDelete.errors).toEqual([notEditable]);
  });
});

const COMPLETE = `mutation($id: ID!) {
  draftOrderComplete(id: $id) {
    order { id status userEmail user { id } shippingMethodName shippingPrice { gross { amount } }
      total { gross { amount } } actions events { type } }
    errors { field code message orderLines variants }
  }
}`;

type CompletePayload = {
  order: {
    id: string;
    status: string;
    userEmail: string | null;
    user: { id: string } | null;
    shippingMethodName: string | null;
    shippingPrice: { gross: { amount: number } };
    total: { gross: { amount: number } };
    actions: string[];
    events: { type: string }[];
  } | null;
  errors: {
    field: string | null;
    code: string;
    message: string;
    orderLines: string[] | null;
    variants: string[] | null;
  }[];
};

describe("draftOrderComplete", () => {
  /** A draft with a customer, addresses, shipping (500 MNT) and 2 shirts (1,000 MNT, 5 in stock). */
  async function readyDraft(staffToken: string) {
    const [warehouse] = await db.select().from(schema.warehouse);
    const shirt = await variant("Shirt", 1000);
    await db
      .update(schema.productVariant)
      .set({ trackInventory: true })
      .where(eq(schema.productVariant.id, shirt.rowId));
    await db
      .insert(schema.stock)
      .values({ warehouseId: warehouse?.id ?? "", variantId: shirt.rowId, quantity: 5 });
    const method = await createShippingMethod(db, { name: "Standard", price: "500" });
    if (!method.ok) throw new Error("no method");
    const draft = await createDraft(staffToken, {
      userEmail: "buyer@example.com",
      shippingAddress: address,
      billingAddress: address,
      shippingMethod: toGlobalId("ShippingMethod", method.shippingMethod.id),
    });
    const added = await gql<{ orderLinesCreate: LinesPayload }>(
      LINES_CREATE,
      { id: draft.id, input: [{ variantId: shirt.id, quantity: 2 }] },
      staffToken,
    );
    return {
      draft,
      shirt,
      methodId: method.shippingMethod.id,
      lineId: added.orderLinesCreate.orderLines?.[0]?.id ?? "",
    };
  }

  const complete = async (id: string, token: string) =>
    (await gql<{ draftOrderComplete: CompletePayload }>(COMPLETE, { id }, token))
      .draftOrderComplete;

  it("needs MANAGE_ORDERS", async () => {
    const other = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);
    expectPermissionDenied(await client.gql(COMPLETE, { id: draft.id }, other.token), [
      "MANAGE_ORDERS",
    ]);
  });

  it("places the order: stock reserved, customer linked, unpaid, then fulfillable", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const buyer = await customer("buyer@example.com");
    const { draft, shirt, lineId } = await readyDraft(staff.token);

    const placed = await complete(draft.id, staff.token);
    expect(placed).toEqual({
      errors: [],
      order: {
        id: draft.id,
        status: "UNFULFILLED",
        userEmail: "buyer@example.com",
        user: { id: toGlobalId("User", buyer.id) },
        shippingMethodName: "Standard",
        shippingPrice: { gross: { amount: 500 } },
        total: { gross: { amount: 2500 } },
        actions: ["MARK_AS_PAID"],
        events: [
          { type: "DRAFT_CREATED" },
          { type: "ADDED_PRODUCTS" },
          { type: "PLACED_FROM_DRAFT" },
        ],
      },
    });
    const [stock] = await db
      .select()
      .from(schema.stock)
      .where(eq(schema.stock.variantId, shirt.rowId));
    expect(stock).toMatchObject({ quantity: 5, quantityAllocated: 2 });

    // Now an order like any other: listed, readable by its customer, no longer a draft.
    const lists = await gql<{
      orders: { totalCount: number };
      draftOrders: { totalCount: number };
    }>(LISTS, {}, staff.token);
    expect([lists.orders.totalCount, lists.draftOrders.totalCount]).toEqual([1, 0]);
    const own = await client.gql(
      "query($id: ID!) { order(id: $id) { id } }",
      { id: draft.id },
      buyer.token,
    );
    expect(own.body).toEqual({ data: { order: { id: draft.id } } });
    expect((await complete(draft.id, staff.token)).errors).toEqual([
      expect.objectContaining({ field: "id", code: "INVALID", message: "The order is not draft." }),
    ]);

    const [warehouse] = await db.select().from(schema.warehouse);
    const fulfilled = await gql<{
      orderFulfill: { order: { status: string } | null; errors: unknown[] };
    }>(
      `mutation($id: ID!, $input: OrderFulfillInput!) {
        orderFulfill(order: $id, input: $input) { order { status } errors { code } }
      }`,
      {
        id: draft.id,
        input: {
          lines: [
            {
              orderLineId: lineId,
              stocks: [{ quantity: 2, warehouse: toGlobalId("Warehouse", warehouse?.id ?? "") }],
            },
          ],
        },
      },
      staff.token,
    );
    expect(fulfilled.orderFulfill).toEqual({ order: { status: "FULFILLED" }, errors: [] });
  });

  it("lists what the draft is missing and stays a draft", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const draft = await createDraft(staff.token);

    const result = await complete(draft.id, staff.token);
    expect(result.order).toBeNull();
    expect(result.errors.map((error) => [error.field, error.code])).toEqual([
      ["billingAddress", "BILLING_ADDRESS_NOT_SET"],
      ["shippingAddress", "ORDER_NO_SHIPPING_ADDRESS"],
      ["shippingMethod", "SHIPPING_METHOD_REQUIRED"],
      ["lines", "REQUIRED"],
      ["userEmail", "REQUIRED"],
    ]);
    const [row] = await db.select().from(schema.order);
    expect(row?.status).toBe("DRAFT");
  });

  it("uses the shipping method's current price and refuses an inactive one", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const { draft, methodId } = await readyDraft(staff.token);

    await db
      .update(schema.shippingMethod)
      .set({ isActive: false })
      .where(eq(schema.shippingMethod.id, methodId));
    expect((await complete(draft.id, staff.token)).errors).toEqual([
      expect.objectContaining({ field: "shippingMethod", code: "SHIPPING_METHOD_NOT_APPLICABLE" }),
    ]);

    await db
      .update(schema.shippingMethod)
      .set({ isActive: true, priceAmount: 800 })
      .where(eq(schema.shippingMethod.id, methodId));
    const placed = await complete(draft.id, staff.token);
    expect(placed.order).toMatchObject({
      shippingPrice: { gross: { amount: 800 } },
      total: { gross: { amount: 2800 } },
    });
  });

  it("refuses short stock and unpublished products, keeping the draft", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const { draft, shirt, lineId } = await readyDraft(staff.token);

    await db
      .update(schema.stock)
      .set({ quantity: 1 })
      .where(eq(schema.stock.variantId, shirt.rowId));
    expect((await complete(draft.id, staff.token)).errors).toEqual([
      {
        field: "lines",
        code: "INSUFFICIENT_STOCK",
        message: "Insufficient product stock.",
        orderLines: [lineId],
        variants: [shirt.id],
      },
    ]);

    await db.update(schema.product).set({ isPublished: false });
    expect((await complete(draft.id, staff.token)).errors).toEqual([
      expect.objectContaining({ field: "lines", code: "PRODUCT_NOT_PUBLISHED" }),
    ]);
    const [row] = await db.select().from(schema.order);
    expect(row?.status).toBe("DRAFT");
    expect(await db.select().from(schema.allocation)).toEqual([]);
  });
});
