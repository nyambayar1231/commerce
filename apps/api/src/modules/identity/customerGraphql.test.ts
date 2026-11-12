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
import { createSession } from "./index.ts";

// Staff customer management through the API (PLAN M7.3): Saleor's `customers` list (who counts as
// a customer, search, sorting, pagination), `user(id)` scopes, and the customer mutations.
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

/** A paid order placed with `email` (it goes to the active account with that email, if any). */
async function placeOrder(email: string) {
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
  return result.order;
}

async function insertCustomer(email: string, firstName = "", lastName = "") {
  const [user] = await db
    .insert(schema.user)
    .values({ email, firstName, lastName })
    .returning({ id: schema.user.id });
  if (!user) throw new Error("no user");
  return { id: user.id, globalId: toGlobalId("User", user.id), email };
}

async function gql<T>(query: string, variables: object, token: string): Promise<T> {
  const { body } = await client.gql(query, variables, token);
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data as T;
}

const CUSTOMERS = `query($first: Int, $last: Int, $after: String, $before: String, $search: String, $sortBy: UserSortingInput) {
  customers(first: $first, last: $last, after: $after, before: $before, search: $search, sortBy: $sortBy) {
    totalCount
    edges { node { email } }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
  }
}`;
type CustomersPage = {
  customers: {
    totalCount: number;
    edges: { node: { email: string } }[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};
const emails = (page: CustomersPage) => page.customers.edges.map((edge) => edge.node.email);

const USER = `query($id: ID!) { user(id: $id) {
  email firstName lastName isStaff isActive dateJoined updatedAt lastLogin
  orders(first: 5) { totalCount }
} }`;
const EMAIL = `query($id: ID!) { user(id: $id) { email } }`;
const CREATE = `mutation($input: UserCreateInput!) {
  customerCreate(input: $input) { user { id email firstName lastName isActive isStaff } errors { field code message } }
}`;
const UPDATE = `mutation($id: ID!, $input: CustomerInput!) {
  customerUpdate(id: $id, input: $input) { user { email firstName isActive } errors { field code message } }
}`;
const DELETE = `mutation($id: ID!) {
  customerDelete(id: $id) { user { id email } errors { field code message } }
}`;
const BULK_DELETE = `mutation($ids: [ID!]!) {
  customerBulkDelete(ids: $ids) { count errors { field code message } }
}`;

describe("permissions", () => {
  it("customers needs MANAGE_ORDERS or MANAGE_USERS; mutations MANAGE_USERS", async () => {
    const customer = await insertCustomer("c@example.com");
    const other = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const orders = await createStaff(db, ["MANAGE_ORDERS"]);

    expectPermissionDenied(await client.gql(CUSTOMERS, { first: 5 }, other.token), [
      "MANAGE_ORDERS",
      "MANAGE_USERS",
    ]);
    expect((await client.gql(CUSTOMERS, { first: 5 }, orders.token)).body.errors).toBeUndefined();
    expectPermissionDenied(await client.gql(USER, { id: customer.globalId }, other.token), [
      "MANAGE_STAFF",
      "MANAGE_USERS",
      "MANAGE_ORDERS",
    ]);
    for (const [doc, variables] of [
      [CREATE, { input: { email: "n@example.com" } }],
      [UPDATE, { id: customer.globalId, input: { firstName: "X" } }],
      [DELETE, { id: customer.globalId }],
      [BULK_DELETE, { ids: [customer.globalId] }],
    ] as const) {
      expectPermissionDenied(await client.gql(doc, variables, orders.token), ["MANAGE_USERS"]);
    }
  });
});

describe("customers", () => {
  it("lists non-staff users and staff who placed an order", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"], { email: "staff@example.com" });
    await createStaff(db, [], { email: "buyer-staff@example.com" });
    await insertCustomer("customer@example.com");
    await placeOrder("buyer-staff@example.com");

    const page = await gql<CustomersPage>(CUSTOMERS, { first: 10 }, staff.token);
    expect(emails(page)).toEqual(["buyer-staff@example.com", "customer@example.com"]);
    expect(page.customers.totalCount).toBe(2);
  });

  it("searches email and names, and sorts by Saleor's fields", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    await insertCustomer("anu@example.com", "Anu", "Bold");
    await insertCustomer("bat@example.com", "Bat", "Dorj");
    await insertCustomer("zaya@shop.mn", "Zaya", "Anand");
    await placeOrder("bat@example.com");
    await placeOrder("bat@example.com");
    await placeOrder("zaya@shop.mn");

    const search = (term: string) =>
      gql<CustomersPage>(CUSTOMERS, { first: 10, search: term }, staff.token).then(emails);
    expect(await search("shop.mn")).toEqual(["zaya@shop.mn"]);
    expect(await search("an")).toEqual(["anu@example.com", "zaya@shop.mn"]);
    expect(await search("bat dorj")).toEqual(["bat@example.com"]);
    expect(await search("100%")).toEqual([]);

    const sorted = (field: string, direction: string) =>
      gql<CustomersPage>(CUSTOMERS, { first: 10, sortBy: { field, direction } }, staff.token).then(
        emails,
      );
    expect(await sorted("LAST_NAME", "ASC")).toEqual([
      "zaya@shop.mn",
      "anu@example.com",
      "bat@example.com",
    ]);
    expect(await sorted("FIRST_NAME", "DESC")).toEqual([
      "zaya@shop.mn",
      "bat@example.com",
      "anu@example.com",
    ]);
    expect(await sorted("ORDER_COUNT", "DESC")).toEqual([
      "bat@example.com",
      "zaya@shop.mn",
      "anu@example.com",
    ]);
  });

  it("pages forwards and backwards without gaps, and rejects a foreign cursor", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    // Equal first names: the order then comes from the last name and the id.
    for (const [index, last] of ["A", "B", "B", "C", "D"].entries()) {
      await insertCustomer(`u${index}@example.com`, "Same", last);
    }
    const sortBy = { field: "FIRST_NAME", direction: "ASC" };
    const all = emails(await gql<CustomersPage>(CUSTOMERS, { first: 10, sortBy }, staff.token));
    expect(all).toHaveLength(5);

    const seen: string[] = [];
    let after: string | null = null;
    for (;;) {
      const page: CustomersPage = await gql<CustomersPage>(
        CUSTOMERS,
        { first: 2, after, sortBy },
        staff.token,
      );
      seen.push(...emails(page));
      if (!page.customers.pageInfo.hasNextPage) break;
      after = page.customers.pageInfo.endCursor;
    }
    expect(seen).toEqual(all);

    const last = await gql<CustomersPage>(CUSTOMERS, { last: 2, sortBy }, staff.token);
    expect(emails(last)).toEqual(all.slice(3));
    expect(last.customers.pageInfo.hasPreviousPage).toBe(true);
    const before = await gql<CustomersPage>(
      CUSTOMERS,
      { last: 2, before: last.customers.pageInfo.startCursor, sortBy },
      staff.token,
    );
    expect(emails(before)).toEqual(all.slice(1, 3));

    const { body } = await client.gql(
      CUSTOMERS,
      { first: 2, after: Buffer.from("[1]").toString("base64") },
      staff.token,
    );
    expect(body.errors?.[0]?.message).toBe("Received cursor is invalid.");
  });
});

describe("user(id)", () => {
  it("follows Saleor's scopes: staff for MANAGE_STAFF, customers for MANAGE_USERS/ORDERS", async () => {
    const customer = await insertCustomer("c@example.com", "Cee");
    const staffUser = await createStaff(db, [], { email: "s@example.com" });
    const staffId = toGlobalId("User", staffUser.id);
    const orders = await createStaff(db, ["MANAGE_ORDERS"]);
    const staffManager = await createStaff(db, ["MANAGE_STAFF"]);
    const both = await createStaff(db, ["MANAGE_STAFF", "MANAGE_USERS"]);
    const read = async (id: string, token: string) =>
      (await gql<{ user: { email: string } | null }>(EMAIL, { id }, token)).user?.email ?? null;

    expect(await read(customer.globalId, orders.token)).toBe("c@example.com");
    expect(await read(staffId, orders.token)).toBeNull();
    expect(await read(customer.globalId, staffManager.token)).toBeNull();
    expect(await read(staffId, staffManager.token)).toBe("s@example.com");
    expect(await read(customer.globalId, both.token)).toBe("c@example.com");
    expect(await read(staffId, both.token)).toBe("s@example.com");
  });

  it("returns the customer's details and orders, with the last login", async () => {
    const orders = await createStaff(db, ["MANAGE_ORDERS"]);
    await client.gql(
      `mutation { accountRegister(input: { email: "c@example.com", password: "password 1", firstName: "Cee", redirectUrl: "http://localhost:3000/confirm" }) { errors { code } } }`,
    );
    // The confirmation flow is tested in accounts.test.ts; here the account only needs to log in.
    await db
      .update(schema.user)
      .set({ isConfirmed: true })
      .where(eq(schema.user.email, "c@example.com"));
    await client.gql(
      `mutation { tokenCreate(email: "c@example.com", password: "password 1") { errors { code } } }`,
    );
    await placeOrder("c@example.com");
    const [row] = await db.select().from(schema.user).where(eq(schema.user.email, "c@example.com"));

    expect(
      (await gql<{ user: unknown }>(USER, { id: toGlobalId("User", row?.id ?? "") }, orders.token))
        .user,
    ).toEqual({
      email: "c@example.com",
      firstName: "Cee",
      lastName: "",
      isStaff: false,
      isActive: true,
      dateJoined: row?.createdAt.toISOString(),
      updatedAt: row?.updatedAt.toISOString(),
      lastLogin: expect.stringMatching(/^\d{4}-/),
      orders: { totalCount: 1 },
    });
  });
});

describe("customer mutations", () => {
  it("customerCreate makes a non-staff user, with Saleor's email errors", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    const created = await gql<{ customerCreate: { user: { id: string }; errors: unknown[] } }>(
      CREATE,
      { input: { email: " New@Example.com ", firstName: " Nomin ", isActive: false } },
      staff.token,
    );
    expect(created.customerCreate).toEqual({
      user: {
        id: expect.any(String),
        email: "new@example.com",
        firstName: "Nomin",
        lastName: "",
        isActive: false,
        isStaff: false,
      },
      errors: [],
    });
    const [row] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "new@example.com"));
    expect(row?.passwordHash).toBeNull();
    // Saleor: unconfirmed until the customer sets a password (not built yet).
    expect(row?.isConfirmed).toBe(false);

    const error = async (email: string) =>
      (
        await gql<{ customerCreate: { errors: unknown[] } }>(
          CREATE,
          { input: { email } },
          staff.token,
        )
      ).customerCreate.errors;
    expect(await error("NEW@example.com")).toEqual([
      { field: "email", code: "UNIQUE", message: "User with this Email already exists." },
    ]);
    expect(await error(" ")).toEqual([
      { field: "email", code: "REQUIRED", message: "This field is required." },
    ]);
    expect(await error("nope")).toEqual([
      { field: "email", code: "INVALID", message: "Enter a valid email address." },
    ]);
  });

  it("customerUpdate changes the given fields and links the new email's guest orders", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    const customer = await insertCustomer("old@example.com", "Old");
    await insertCustomer("taken@example.com");
    const guestOrder = await placeOrder("new@example.com");
    const [before] = await db.select().from(schema.user).where(eq(schema.user.id, customer.id));

    expect(
      (
        await gql<{ customerUpdate: unknown }>(
          UPDATE,
          { id: customer.globalId, input: { isActive: false } },
          staff.token,
        )
      ).customerUpdate,
    ).toEqual({
      user: { email: "old@example.com", firstName: "Old", isActive: false },
      errors: [],
    });
    const [after] = await db.select().from(schema.user).where(eq(schema.user.id, customer.id));
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);

    expect(
      (
        await gql<{ customerUpdate: unknown }>(
          UPDATE,
          { id: customer.globalId, input: { email: "TAKEN@example.com" } },
          staff.token,
        )
      ).customerUpdate,
    ).toEqual({
      user: null,
      errors: [{ field: "email", code: "UNIQUE", message: "User with this Email already exists." }],
    });

    await gql(UPDATE, { id: customer.globalId, input: { email: "New@Example.com" } }, staff.token);
    const [order] = await db.select().from(schema.order).where(eq(schema.order.id, guestOrder.id));
    expect(order?.userId).toBe(customer.id);
  });

  it("customerUpdate refuses staff accounts and unknown ids", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    const superuser = await createStaff(db, [], { superuser: true });
    expect(
      (
        await gql<{ customerUpdate: unknown }>(
          UPDATE,
          { id: toGlobalId("User", superuser.id), input: { isActive: false } },
          staff.token,
        )
      ).customerUpdate,
    ).toEqual({
      user: null,
      errors: [{ field: "id", code: "INVALID", message: "Cannot edit a staff account." }],
    });
    const unknown = toGlobalId("User", crypto.randomUUID());
    const { body } = await client.gql(UPDATE, { id: unknown, input: {} }, staff.token);
    expect(body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
  });

  it("customerDelete keeps the orders and ends the sessions; staff and self are refused", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    const customer = await insertCustomer("c@example.com");
    const { token } = await createSession(db, customer.id);
    const order = await placeOrder("c@example.com");
    expect(order.userId).toBe(customer.id);

    expect(
      (await gql<{ customerDelete: unknown }>(DELETE, { id: customer.globalId }, staff.token))
        .customerDelete,
    ).toEqual({ user: { id: customer.globalId, email: "c@example.com" }, errors: [] });
    const [kept] = await db.select().from(schema.order).where(eq(schema.order.id, order.id));
    expect(kept?.userId).toBeNull();
    expect((await client.gql(`{ me { email } }`, {}, token)).body.data).toEqual({ me: null });

    const refused = async (id: string) =>
      (await gql<{ customerDelete: unknown }>(DELETE, { id }, staff.token)).customerDelete;
    expect(await refused(toGlobalId("User", staff.id))).toEqual({
      user: null,
      errors: [
        { field: "id", code: "DELETE_OWN_ACCOUNT", message: "You cannot delete your own account." },
      ],
    });
    const superuser = await createStaff(db, [], { superuser: true });
    expect(await refused(toGlobalId("User", superuser.id))).toEqual({
      user: null,
      errors: [
        { field: "id", code: "DELETE_SUPERUSER_ACCOUNT", message: "Cannot delete this account." },
      ],
    });
    const colleague = await createStaff(db, []);
    expect(await refused(toGlobalId("User", colleague.id))).toEqual({
      user: null,
      errors: [
        { field: "id", code: "DELETE_STAFF_ACCOUNT", message: "Cannot delete a staff account." },
      ],
    });
  });

  it("customerBulkDelete deletes the customers and reports the refused ids", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    const first = await insertCustomer("a@example.com");
    const second = await insertCustomer("b@example.com");
    const colleague = await createStaff(db, []);
    const colleagueId = toGlobalId("User", colleague.id);

    expect(
      (
        await gql<{ customerBulkDelete: unknown }>(
          BULK_DELETE,
          { ids: [first.globalId, second.globalId, colleagueId] },
          staff.token,
        )
      ).customerBulkDelete,
    ).toEqual({
      count: 2,
      errors: [
        {
          field: colleagueId,
          code: "DELETE_STAFF_ACCOUNT",
          message: "Cannot delete a staff account.",
        },
      ],
    });
    expect((await db.select().from(schema.user)).map((user) => user.id).sort()).toEqual(
      [staff.id, colleague.id].sort(),
    );
  });
});
