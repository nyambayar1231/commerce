import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { decodeGlobalId, toGlobalId } from "../../graphql/globalId.ts";

// Shipping methods (staff) and checkout addresses/delivery (anonymous buyer) through the app (M5.2).
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, product, checkout, shipping_method CASCADE',
  );
});

afterAll(async () => {
  await closeDb();
});

const CREATE_METHOD = `mutation($input: ShippingPriceInput!) {
  shippingPriceCreate(input: $input) {
    shippingMethod { id name isActive price { amount currency } }
    errors { field code message }
  }
}`;

type MethodData = {
  id: string;
  name: string;
  isActive: boolean;
  price: { amount: number; currency: string };
};

async function createMethod(token: string, name: string, price: string): Promise<MethodData> {
  const { body } = await client.gql(CREATE_METHOD, { input: { name, price } }, token);
  const payload = body.data?.shippingPriceCreate as {
    shippingMethod: MethodData | null;
    errors: unknown[];
  };
  if (!payload.shippingMethod) throw new Error(JSON.stringify(payload.errors));
  return payload.shippingMethod;
}

/** A checkout with one line of an untracked, published 1000 MNT variant; returns its global ID. */
async function checkoutId(): Promise<string> {
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: `boots-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({ productId: product.id, priceAmount: 1000, currency: "MNT", trackInventory: false })
    .returning();
  if (!variant) throw new Error("no variant");
  const { body } = await client.gql(
    `mutation($input: CheckoutCreateInput!) { checkoutCreate(input: $input) { checkout { id } } }`,
    { input: { lines: [{ variantId: toGlobalId("ProductVariant", variant.id), quantity: 1 }] } },
  );
  const created = body.data?.checkoutCreate as { checkout: { id: string } } | undefined;
  if (!created) throw new Error(JSON.stringify(body.errors));
  return created.checkout.id;
}

describe("shipping method administration", () => {
  it("creates, updates, lists and deletes methods with MANAGE_SHIPPING", async () => {
    const staff = await createStaff(db, ["MANAGE_SHIPPING"]);
    const method = await createMethod(staff.token, "Standard", "5000");
    expect(method).toMatchObject({
      name: "Standard",
      isActive: true,
      price: { amount: 5000, currency: "MNT" },
    });

    const updated = await client.gql(
      `mutation($id: ID!, $input: ShippingPriceInput!) {
        shippingPriceUpdate(id: $id, input: $input) { shippingMethod { isActive } errors { code } }
      }`,
      { id: method.id, input: { isActive: false } },
      staff.token,
    );
    expect(updated.body.data?.shippingPriceUpdate).toEqual({
      shippingMethod: { isActive: false },
      errors: [],
    });

    const list = await client.gql("{ shippingMethods { name } }", {}, staff.token);
    expect(list.body.data?.shippingMethods).toEqual([{ name: "Standard" }]);

    const deleted = await client.gql(
      `mutation($id: ID!) { shippingPriceDelete(id: $id) { shippingMethod { name } errors { code } } }`,
      { id: method.id },
      staff.token,
    );
    expect(deleted.body.data?.shippingPriceDelete).toEqual({
      shippingMethod: { name: "Standard" },
      errors: [],
    });
  });

  it("returns ShippingError values and denies callers without MANAGE_SHIPPING", async () => {
    const staff = await createStaff(db, ["MANAGE_SHIPPING"]);
    const invalid = await client.gql(
      CREATE_METHOD,
      { input: { name: "", price: "-5" } },
      staff.token,
    );
    expect(invalid.body.data?.shippingPriceCreate).toMatchObject({
      shippingMethod: null,
      errors: [
        { field: "name", code: "REQUIRED" },
        { field: "price", code: "INVALID" },
      ],
    });

    const other = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expectPermissionDenied(await client.gql("{ shippingMethods { name } }", {}, other.token), [
      "MANAGE_SHIPPING",
    ]);
  });
});

const CHECKOUT_SHIPPING = `
  shippingAddress { firstName city country { code country } phone }
  billingAddress { city }
  shippingMethods { id name active price { amount } }
  delivery { id shippingMethod { name } }
  shippingPrice { gross { amount } }
  totalPrice { gross { amount } }
`;

describe("checkout addresses and delivery", () => {
  it("sets addresses, lists methods, chooses one and charges it", async () => {
    const staff = await createStaff(db, ["MANAGE_SHIPPING"]);
    const method = await createMethod(staff.token, "Standard", "5000");
    const id = await checkoutId();
    const address = {
      firstName: "Bat",
      lastName: "Dorj",
      streetAddress1: "Peace Avenue 1",
      city: "Ulaanbaatar",
      country: "MN",
    };

    const shipped = await client.gql(
      `mutation($id: ID!, $address: AddressInput!) {
        checkoutShippingAddressUpdate(id: $id, shippingAddress: $address) {
          checkout { shippingAddress { city country { code country } } } errors { field code }
        }
      }`,
      { id, address },
    );
    expect(shipped.body.data?.checkoutShippingAddressUpdate).toEqual({
      checkout: {
        shippingAddress: { city: "Ulaanbaatar", country: { code: "MN", country: "Mongolia" } },
      },
      errors: [],
    });

    await client.gql(
      `mutation($id: ID!, $address: AddressInput!) {
        checkoutBillingAddressUpdate(id: $id, billingAddress: $address) { errors { code } }
      }`,
      { id, address: { ...address, city: "Darkhan" } },
    );

    // Staff see the method as ShippingMethodType; buyers choose it as Saleor's ShippingMethod.
    const buyerMethodId = toGlobalId("ShippingMethod", decodeGlobalId(method.id).id);
    const chosen = await client.gql(
      `mutation($id: ID!, $method: ID) {
        checkoutDeliveryMethodUpdate(id: $id, deliveryMethodId: $method) {
          checkout { ${CHECKOUT_SHIPPING} } errors { field code }
        }
      }`,
      { id, method: buyerMethodId },
    );
    expect(chosen.body.data?.checkoutDeliveryMethodUpdate).toEqual({
      checkout: {
        shippingAddress: {
          firstName: "Bat",
          city: "Ulaanbaatar",
          country: { code: "MN", country: "Mongolia" },
          phone: null,
        },
        billingAddress: { city: "Darkhan" },
        shippingMethods: [
          { id: buyerMethodId, name: "Standard", active: true, price: { amount: 5000 } },
        ],
        delivery: { id: buyerMethodId, shippingMethod: { name: "Standard" } },
        shippingPrice: { gross: { amount: 5000 } },
        totalPrice: { gross: { amount: 6000 } },
      },
      errors: [],
    });
  });

  it("reports address errors with addressType and rejects a non-shipping-method ID", async () => {
    const id = await checkoutId();
    const invalid = await client.gql(
      `mutation($id: ID!) {
        checkoutShippingAddressUpdate(id: $id, shippingAddress: { firstName: "Bat" }) {
          errors { field code addressType }
        }
      }`,
      { id },
    );
    expect(invalid.body.data?.checkoutShippingAddressUpdate).toEqual({
      errors: [
        { field: "lastName", code: "REQUIRED", addressType: "SHIPPING" },
        { field: "streetAddress1", code: "REQUIRED", addressType: "SHIPPING" },
        { field: "city", code: "REQUIRED", addressType: "SHIPPING" },
        { field: "country", code: "REQUIRED", addressType: "SHIPPING" },
      ],
    });

    const wrongType = await client.gql(
      `mutation($id: ID!, $method: ID) {
        checkoutDeliveryMethodUpdate(id: $id, deliveryMethodId: $method) { errors { field code } }
      }`,
      { id, method: toGlobalId("Warehouse", crypto.randomUUID()) },
    );
    expect(wrongType.body.data?.checkoutDeliveryMethodUpdate).toEqual({
      errors: [{ field: "deliveryMethodId", code: "INVALID" }],
    });
  });
});
