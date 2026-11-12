import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { decodeGlobalId, toGlobalId } from "../../graphql/globalId.ts";

// The whole buyer journey through the app, anonymously: create → address → shipping → pay →
// complete, then the staff view of the order (M5 acceptance, PLAN M5).
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, "order", checkout, product, shipping_method, allocation, payment_transaction CASCADE',
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

const ORDER_FIELDS = `
  id number status userEmail shippingMethodName checkoutId
  shippingAddress { city country { code } }
  subtotal { gross { amount } } shippingPrice { gross { amount } } total { gross { amount currency } }
  lines { productName variantName productSku quantity unitPrice { gross { amount } } totalPrice { gross { amount } } variant { id } }
  transactions { chargedAmount { amount } order { id } }
`;

describe("checkoutComplete", () => {
  it("places an order for a paid checkout, and returns it again on a retry", async () => {
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
    const id = created.checkoutCreate.checkout.id;
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
      { id, a: address, m: toGlobalId("ShippingMethod", methodPk) },
    );

    const COMPLETE = `mutation($id: ID!) {
      checkoutComplete(id: $id) { order { ${ORDER_FIELDS} } confirmationNeeded errors { field code } }
    }`;
    const unpaid = await gql<{ checkoutComplete: { order: unknown; errors: { code: string }[] } }>(
      COMPLETE,
      { id },
    );
    expect(unpaid.checkoutComplete).toMatchObject({
      order: null,
      errors: [{ code: "CHECKOUT_NOT_FULLY_PAID" }],
    });

    await gql(
      `mutation($id: ID!) {
        transactionInitialize(id: $id, paymentGateway: { id: "saleor.io.dummy-payment-app" }) { errors { code } }
      }`,
      { id },
    );
    const placed = await gql<{
      checkoutComplete: { order: { id: string; number: string }; errors: unknown[] };
    }>(COMPLETE, { id });
    expect(placed.checkoutComplete).toEqual({
      order: {
        id: expect.any(String),
        number: expect.stringMatching(/^\d+$/),
        status: "UNFULFILLED",
        userEmail: "buyer@example.com",
        shippingMethodName: "Standard",
        checkoutId: id,
        shippingAddress: { city: "Ulaanbaatar", country: { code: "MN" } },
        subtotal: { gross: { amount: 2000 } },
        shippingPrice: { gross: { amount: 500 } },
        total: { gross: { amount: 2500, currency: "MNT" } },
        lines: [
          {
            productName: "Boots",
            variantName: "42",
            productSku: "BOOTS-42",
            quantity: 2,
            unitPrice: { gross: { amount: 1000 } },
            totalPrice: { gross: { amount: 2000 } },
            variant: { id: variantId },
          },
        ],
        transactions: [
          { chargedAmount: { amount: 2500 }, order: { id: placed.checkoutComplete.order.id } },
        ],
      },
      confirmationNeeded: false,
      errors: [],
    });

    const retry = await gql<{ checkoutComplete: { order: { id: string } } }>(COMPLETE, { id });
    expect(retry.checkoutComplete.order.id).toBe(placed.checkoutComplete.order.id);

    const orderId = placed.checkoutComplete.order.id;
    // The history is staff-only (Saleor's Order.events needs MANAGE_ORDERS).
    const staffView = await gql<{ order: { number: string; events: unknown } }>(
      `query($id: ID!) { order(id: $id) { number events { type } } }`,
      { id: orderId },
      staff.token,
    );
    expect(staffView.order).toEqual({
      number: placed.checkoutComplete.order.number,
      events: [{ type: "PLACED" }],
    });
    expectPermissionDenied(
      await client.gql(`query($id: ID!) { order(id: $id) { number } }`, { id: orderId }),
      ["MANAGE_ORDERS"],
    );
  });
});
