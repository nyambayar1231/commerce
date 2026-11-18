import { cleanAddress } from "@commerce/contracts";
import { closeDb, getDb, schema } from "@commerce/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createCheckout, updateCheckoutAddress } from "../checkout/index.ts";
import {
  createSession,
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  getUserDefaultAddress,
  MAX_USER_ADDRESSES,
  setDefaultUserAddress,
  storeUserAddresses,
  updateUserAddress,
} from "./index.ts";

// The customer address book (PLAN M15.2): Saleor's accountAddress* mutations and
// `User.addresses`/default fields, through the real app and the real (test) database, plus the
// domain functions checkout completion calls.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, address CASCADE');
});

afterAll(async () => {
  await closeDb();
});

const ADDRESS = {
  firstName: "Bat",
  lastName: "Dorj",
  streetAddress1: "Peace Avenue 1",
  city: "Ulaanbaatar",
  country: "MN",
};

async function createCustomer(email = `${crypto.randomUUID()}@example.com`) {
  const [user] = await db.insert(schema.user).values({ email }).returning({ id: schema.user.id });
  if (!user) throw new Error("no user");
  const { token } = await createSession(db, user.id);
  return { id: user.id, email, token };
}

async function gql<T>(query: string, variables: object = {}, token?: string): Promise<T> {
  const { body } = await client.gql(query, variables, token);
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data as T;
}

type AddressNode = {
  id: string | null;
  firstName: string;
  city: string;
  country: { code: string };
  isDefaultShippingAddress: boolean | null;
  isDefaultBillingAddress: boolean | null;
};

type Me = {
  me: {
    addresses: AddressNode[];
    defaultShippingAddress: { id: string; firstName: string } | null;
    defaultBillingAddress: { id: string; firstName: string } | null;
  };
};

const ME = `{
  me {
    addresses { id firstName city country { code } isDefaultShippingAddress isDefaultBillingAddress }
    defaultShippingAddress { id firstName }
    defaultBillingAddress { id firstName }
  }
}`;

const ADDRESS_FIELDS = `
  id firstName lastName streetAddress1 city country { code }
  isDefaultShippingAddress isDefaultBillingAddress
`;

const CREATE = `mutation($input: AddressInput!, $type: AddressTypeEnum) {
  accountAddressCreate(input: $input, type: $type) {
    user { id }
    address { ${ADDRESS_FIELDS} }
    errors { field code message }
  }
}`;

const UPDATE = `mutation($id: ID!, $input: AddressInput!) {
  accountAddressUpdate(id: $id, input: $input) {
    user { id }
    address { ${ADDRESS_FIELDS} }
    errors { field code message }
  }
}`;

const DELETE = `mutation($id: ID!) {
  accountAddressDelete(id: $id) {
    user { id }
    address { ${ADDRESS_FIELDS} }
    errors { field code message }
  }
}`;

const SET_DEFAULT = `mutation($id: ID!, $type: AddressTypeEnum!) {
  accountSetDefaultAddress(id: $id, type: $type) {
    user { id }
    errors { field code message }
  }
}`;

type MutationPayload = {
  user: { id: string } | null;
  address: AddressNode | null;
  errors: { field: string | null; code: string; message: string }[];
};

describe("address book domain", () => {
  it("creates, partially updates and deletes one user's address", async () => {
    const user = await createCustomer();

    const created = await createUserAddress(db, user.id, ADDRESS);
    if (!created.ok) throw new Error(JSON.stringify(created.errors));
    expect(created.address).toMatchObject(ADDRESS);
    expect(created.address.isDefaultShippingAddress).toBe(false);

    const updated = await updateUserAddress(db, user.id, created.address.id, {
      city: "Erdenet",
    });
    if (!updated.ok) throw new Error(JSON.stringify(updated.errors));
    // Fields left out keep their value (a partial update).
    expect(updated.address).toMatchObject({ ...ADDRESS, city: "Erdenet" });

    expect(await getUserAddresses(db, user.id)).toHaveLength(1);
    const deleted = await deleteUserAddress(db, user.id, created.address.id);
    expect(deleted.ok).toBe(true);
    expect(await getUserAddresses(db, user.id)).toEqual([]);
  });

  it("sets a default, and deleting that address clears it", async () => {
    const user = await createCustomer();
    const first = await createUserAddress(db, user.id, ADDRESS);
    const second = await createUserAddress(db, user.id, { ...ADDRESS, streetAddress1: "2" });
    if (!first.ok || !second.ok) throw new Error("no address");

    expect(await setDefaultUserAddress(db, user.id, second.address.id, "SHIPPING")).toEqual({
      ok: true,
    });
    expect(await setDefaultUserAddress(db, user.id, second.address.id, "BILLING")).toEqual({
      ok: true,
    });
    expect(await getUserDefaultAddress(db, user.id, "SHIPPING")).toMatchObject({
      id: second.address.id,
      isDefaultShippingAddress: true,
      isDefaultBillingAddress: true,
    });
    expect(
      (await getUserAddresses(db, user.id)).map((entry) => [
        entry.id,
        entry.isDefaultShippingAddress,
        entry.isDefaultBillingAddress,
      ]),
    ).toEqual([
      [first.address.id, false, false],
      [second.address.id, true, true],
    ]);

    await deleteUserAddress(db, user.id, second.address.id);
    expect(await getUserDefaultAddress(db, user.id, "SHIPPING")).toBeNull();
    expect(await getUserDefaultAddress(db, user.id, "BILLING")).toBeNull();
  });

  it("returns cleanAddress errors and stores nothing", async () => {
    const user = await createCustomer();
    const result = await createUserAddress(db, user.id, { firstName: "Bat", country: "MN" });
    if (result.ok) throw new Error("expected errors");
    expect(result.errors.map((error) => [error.field, error.code])).toEqual([
      ["lastName", "REQUIRED"],
      ["streetAddress1", "REQUIRED"],
      ["city", "REQUIRED"],
    ]);
    expect(await getUserAddresses(db, user.id)).toEqual([]);
  });

  it("answers a foreign or unknown id the same way for every mutation", async () => {
    const owner = await createCustomer();
    const other = await createCustomer();
    const created = await createUserAddress(db, owner.id, ADDRESS);
    if (!created.ok) throw new Error("no address");
    const unknown = crypto.randomUUID();

    for (const id of [created.address.id, unknown]) {
      expect(await updateUserAddress(db, other.id, id, { city: "X" })).toMatchObject({
        ok: false,
        errors: [{ field: "id", code: "NOT_FOUND" }],
      });
      expect(await deleteUserAddress(db, other.id, id)).toMatchObject({
        ok: false,
        errors: [{ field: "id", code: "NOT_FOUND" }],
      });
      expect(await setDefaultUserAddress(db, other.id, id, "SHIPPING")).toMatchObject({
        ok: false,
        errors: [{ field: "id", code: "NOT_FOUND" }],
      });
    }

    // The owner's address is untouched and the other user's book is still empty.
    expect((await getUserAddresses(db, owner.id))[0]).toMatchObject({
      ...ADDRESS,
      city: "Ulaanbaatar",
    });
    expect(await getUserAddresses(db, other.id)).toEqual([]);
  });

  it("replaces the oldest non-default address at the limit", async () => {
    const user = await createCustomer();
    const rows = await db
      .insert(schema.address)
      .values(
        Array.from({ length: MAX_USER_ADDRESSES }, (_, index) => ({
          userId: user.id,
          ...ADDRESS,
          streetAddress1: `Street ${index}`,
        })),
      )
      .returning({ id: schema.address.id });
    // The two oldest are defaults, so the third is the one removed.
    await db
      .update(schema.user)
      .set({
        defaultShippingAddressId: rows[0]?.id ?? "",
        defaultBillingAddressId: rows[1]?.id ?? "",
      })
      .where(eq(schema.user.id, user.id));

    const created = await createUserAddress(db, user.id, { ...ADDRESS, streetAddress1: "New" });
    if (!created.ok) throw new Error(JSON.stringify(created.errors));

    const remaining = (
      await db
        .select({ id: schema.address.id })
        .from(schema.address)
        .where(eq(schema.address.userId, user.id))
        .orderBy(asc(schema.address.createdAt), asc(schema.address.id))
    ).map((row) => row.id);
    expect(remaining).toHaveLength(MAX_USER_ADDRESSES);
    expect(remaining).toContain(rows[0]?.id);
    expect(remaining).toContain(rows[1]?.id);
    expect(remaining).not.toContain(rows[2]?.id);
    expect(remaining).toContain(created.address.id);
  });

  it("stores checkout addresses once, setting defaults only when missing", async () => {
    const user = await createCustomer();

    // Completing twice with the same address leaves one row and sets both defaults.
    const cleaned = cleanAddress(ADDRESS);
    if (!cleaned.ok) throw new Error(JSON.stringify(cleaned.errors));
    await storeUserAddresses(db, user.id, { shipping: cleaned.address, billing: cleaned.address });
    await storeUserAddresses(db, user.id, { shipping: cleaned.address, billing: cleaned.address });
    const addresses = await getUserAddresses(db, user.id);
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({
      ...ADDRESS,
      isDefaultShippingAddress: true,
      isDefaultBillingAddress: true,
    });

    // A different address is added, but the defaults stay as they were.
    const second = cleanAddress({ ...ADDRESS, streetAddress1: "Second" });
    if (!second.ok) throw new Error(JSON.stringify(second.errors));
    await storeUserAddresses(db, user.id, { shipping: second.address, billing: null });
    const after = await getUserAddresses(db, user.id);
    expect(after).toHaveLength(2);
    expect(await getUserDefaultAddress(db, user.id, "SHIPPING")).toMatchObject({
      id: addresses[0]?.id,
    });
  });
});

describe("accountAddress mutations through the API", () => {
  it("creates, updates, deletes and sets defaults, and me reflects it", async () => {
    const user = await createCustomer();

    const created = await gql<{ accountAddressCreate: MutationPayload }>(
      CREATE,
      { input: ADDRESS, type: "SHIPPING" },
      user.token,
    );
    const first = created.accountAddressCreate;
    expect(first.errors).toEqual([]);
    expect(first.user).toEqual({ id: toGlobalId("User", user.id) });
    expect(first.address).toMatchObject({
      ...ADDRESS,
      country: { code: "MN" },
      isDefaultShippingAddress: true,
      isDefaultBillingAddress: false,
    });
    const firstId = first.address?.id ?? "";
    expect(firstId).toBe(toGlobalId("Address", (await getUserAddresses(db, user.id))[0]?.id ?? ""));

    const second = (
      await gql<{ accountAddressCreate: MutationPayload }>(
        CREATE,
        { input: { ...ADDRESS, streetAddress1: "Second" } },
        user.token,
      )
    ).accountAddressCreate;
    const secondId = second.address?.id ?? "";

    // Oldest first, with the default flags.
    expect((await gql<Me>(ME, {}, user.token)).me.addresses).toMatchObject([
      { id: firstId, isDefaultShippingAddress: true, isDefaultBillingAddress: false },
      { id: secondId, isDefaultShippingAddress: false, isDefaultBillingAddress: false },
    ]);

    const setDefault = await gql<{ accountSetDefaultAddress: MutationPayload }>(
      SET_DEFAULT,
      { id: secondId, type: "BILLING" },
      user.token,
    );
    expect(setDefault.accountSetDefaultAddress.errors).toEqual([]);
    const withDefault = (await gql<Me>(ME, {}, user.token)).me;
    expect(withDefault.defaultBillingAddress).toMatchObject({ id: secondId });
    expect(withDefault.defaultShippingAddress).toMatchObject({ id: firstId });

    const updated = (
      await gql<{ accountAddressUpdate: MutationPayload }>(
        UPDATE,
        { id: secondId, input: { city: "Erdenet" } },
        user.token,
      )
    ).accountAddressUpdate;
    expect(updated.errors).toEqual([]);
    expect(updated.address).toMatchObject({
      ...ADDRESS,
      streetAddress1: "Second",
      country: { code: "MN" },
      city: "Erdenet",
    });

    // Deleting the default billing address clears it (the FK does).
    const deleted = (
      await gql<{ accountAddressDelete: MutationPayload }>(DELETE, { id: secondId }, user.token)
    ).accountAddressDelete;
    expect(deleted.errors).toEqual([]);
    expect(deleted.address).toMatchObject({ id: secondId });
    const afterDelete = (await gql<Me>(ME, {}, user.token)).me;
    expect(afterDelete.addresses).toHaveLength(1);
    expect(afterDelete.defaultBillingAddress).toBeNull();
    expect(afterDelete.defaultShippingAddress).toMatchObject({ id: firstId });
  });

  it("returns the cleanAddress field errors and stores nothing", async () => {
    const user = await createCustomer();
    const result = (
      await gql<{ accountAddressCreate: MutationPayload }>(
        CREATE,
        { input: { firstName: "Bat", country: "MN" } },
        user.token,
      )
    ).accountAddressCreate;
    expect(result.user).toBeNull();
    expect(result.errors).toEqual([
      { field: "lastName", code: "REQUIRED", message: "This field is required." },
      { field: "streetAddress1", code: "REQUIRED", message: "This field is required." },
      { field: "city", code: "REQUIRED", message: "This field is required." },
    ]);
    expect((await gql<Me>(ME, {}, user.token)).me.addresses).toEqual([]);
  });

  it("answers another user's, an unknown and a malformed id with the same NOT_FOUND", async () => {
    const owner = await createCustomer();
    const other = await createCustomer();
    const created = (
      await gql<{ accountAddressCreate: MutationPayload }>(CREATE, { input: ADDRESS }, owner.token)
    ).accountAddressCreate;
    const ownerId = created.address?.id ?? "";

    const unknown = toGlobalId("Address", crypto.randomUUID());
    for (const id of [ownerId, unknown, "not-a-global-id"]) {
      const updated = (
        await gql<{ accountAddressUpdate: MutationPayload }>(
          UPDATE,
          { id, input: { city: "X" } },
          other.token,
        )
      ).accountAddressUpdate;
      expect(updated).toMatchObject({
        user: null,
        address: null,
        errors: [{ field: "id", code: "NOT_FOUND", message: "Couldn't resolve to a node." }],
      });

      const deleted = (
        await gql<{ accountAddressDelete: MutationPayload }>(DELETE, { id }, other.token)
      ).accountAddressDelete;
      expect(deleted).toMatchObject({
        user: null,
        address: null,
        errors: [{ field: "id", code: "NOT_FOUND", message: "Couldn't resolve to a node." }],
      });

      const setDefault = (
        await gql<{ accountSetDefaultAddress: MutationPayload }>(
          SET_DEFAULT,
          { id, type: "SHIPPING" },
          other.token,
        )
      ).accountSetDefaultAddress;
      expect(setDefault).toMatchObject({
        user: null,
        errors: [{ field: "id", code: "NOT_FOUND", message: "Couldn't resolve to a node." }],
      });
    }

    expect((await gql<Me>(ME, {}, owner.token)).me.addresses).toHaveLength(1);
    expect((await gql<Me>(ME, {}, owner.token)).me.addresses[0]).toMatchObject({
      city: "Ulaanbaatar",
    });
    expect((await gql<Me>(ME, {}, other.token)).me.addresses).toEqual([]);
  });

  it("requires a logged-in user on every mutation", async () => {
    const id = toGlobalId("Address", crypto.randomUUID());
    for (const [document, variables] of [
      [CREATE, { input: ADDRESS }],
      [UPDATE, { id, input: { city: "X" } }],
      [DELETE, { id }],
      [SET_DEFAULT, { id, type: "SHIPPING" }],
    ] as const) {
      expectPermissionDenied(await client.gql(document, variables), ["AUTHENTICATED_USER"]);
    }
  });

  it("hides another user's addresses without MANAGE_USERS and shows them with it", async () => {
    const customer = await createCustomer();
    const created = (
      await gql<{ accountAddressCreate: MutationPayload }>(
        CREATE,
        { input: ADDRESS },
        customer.token,
      )
    ).accountAddressCreate;
    const customerId = toGlobalId("User", customer.id);
    const USER_ADDRESSES = `query($id: ID!) { user(id: $id) { addresses { id city } } }`;

    const orders = await createStaff(db, ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(USER_ADDRESSES, { id: customerId }, orders.token), [
      "OWNER",
      "MANAGE_USERS",
    ]);

    const users = await createStaff(db, ["MANAGE_USERS"]);
    const visible = (
      await gql<{ user: { addresses: { id: string; city: string }[] } }>(
        USER_ADDRESSES,
        { id: customerId },
        users.token,
      )
    ).user;
    expect(visible.addresses).toEqual([{ id: created.address?.id, city: "Ulaanbaatar" }]);
  });

  it("keeps checkout and order snapshot addresses without an id", async () => {
    const checkout = await createCheckout(db, { lines: [], email: "buyer@example.com" });
    if (!checkout.ok) throw new Error("no checkout");
    await updateCheckoutAddress(db, checkout.checkout.id, "SHIPPING", ADDRESS);

    const data = await gql<{
      checkout: { shippingAddress: { id: string | null; firstName: string } | null };
    }>(`query($id: ID!) { checkout(id: $id) { shippingAddress { id firstName } } }`, {
      id: toGlobalId("Checkout", checkout.checkout.id),
    });
    expect(data.checkout.shippingAddress).toEqual({ id: null, firstName: "Bat" });
  });
});
