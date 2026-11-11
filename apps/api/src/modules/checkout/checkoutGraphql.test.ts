import { closeDb, getDb, schema } from "@commerce/db";
import { ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient, type GqlResult } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// Saleor's checkout cart API through the real app and commerce_test, as an anonymous buyer
// (PLAN M5 decision 5: the checkout is used by holding its id).
const db = getDb();
const client = createTestClient(db);

let warehouseId: string;

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", product, checkout, permission_group CASCADE');
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));
  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  warehouseId = warehouse.id;
});

afterAll(async () => {
  await closeDb();
});

async function seedVariant(price: number, stock?: number) {
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: `boots-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product.id,
      sku: `SKU-${suffix}`,
      priceAmount: price,
      currency: "MNT",
      trackInventory: stock !== undefined,
    })
    .returning();
  if (!variant) throw new Error("no variant");
  if (stock !== undefined) {
    await db.insert(schema.stock).values({ warehouseId, variantId: variant.id, quantity: stock });
  }
  return toGlobalId("ProductVariant", variant.id);
}

const CHECKOUT_FIELDS = `
  id
  token
  email
  quantity
  lines { id quantity variant { id } unitPrice { gross { amount } } totalPrice { gross { amount } } }
  subtotalPrice { net { amount } gross { amount } tax { amount } currency }
  totalPrice { gross { amount currency } }
`;
const ERROR_FIELDS = "errors { field code message variants lines }";

type CheckoutData = {
  id: string;
  token: string;
  email: string | null;
  quantity: number;
  lines: {
    id: string;
    quantity: number;
    variant: { id: string };
    unitPrice: { gross: { amount: number } };
    totalPrice: { gross: { amount: number } };
  }[];
  subtotalPrice: {
    net: { amount: number };
    gross: { amount: number };
    tax: { amount: number };
    currency: string;
  };
  totalPrice: { gross: { amount: number; currency: string } };
};
type ErrorData = {
  field: string | null;
  code: string;
  message: string;
  variants: string[] | null;
  lines: string[] | null;
};
type Payload = { checkout: CheckoutData | null; errors: ErrorData[] };

function payload(result: GqlResult, field: string): Payload {
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as Record<string, Payload>)[field] as Payload;
}

const CREATE = `mutation($input: CheckoutCreateInput!) {
  checkoutCreate(input: $input) { created checkout { ${CHECKOUT_FIELDS} } ${ERROR_FIELDS} }
}`;
const ADD = `mutation($id: ID!, $lines: [CheckoutLineInput!]!) {
  checkoutLinesAdd(id: $id, lines: $lines) { checkout { ${CHECKOUT_FIELDS} } ${ERROR_FIELDS} }
}`;
const UPDATE = `mutation($id: ID!, $lines: [CheckoutLineUpdateInput!]!) {
  checkoutLinesUpdate(id: $id, lines: $lines) { checkout { ${CHECKOUT_FIELDS} } ${ERROR_FIELDS} }
}`;
const DELETE = `mutation($id: ID!, $linesIds: [ID!]!) {
  checkoutLinesDelete(id: $id, linesIds: $linesIds) { checkout { ${CHECKOUT_FIELDS} } ${ERROR_FIELDS} }
}`;
const EMAIL = `mutation($id: ID!, $email: String!) {
  checkoutEmailUpdate(id: $id, email: $email) { checkout { ${CHECKOUT_FIELDS} } ${ERROR_FIELDS} }
}`;
const QUERY = `query($id: ID) { checkout(id: $id) { ${CHECKOUT_FIELDS} } }`;

describe("checkout cart API", () => {
  it("runs create → add → update → delete → email → checkout(id) anonymously", async () => {
    const boots = await seedVariant(1000);
    const socks = await seedVariant(250);

    const created = payload(
      await client.gql(CREATE, { input: { lines: [{ variantId: boots, quantity: 2 }] } }),
      "checkoutCreate",
    );
    expect(created.errors).toEqual([]);
    const checkout = created.checkout;
    if (!checkout) throw new Error("no checkout");
    expect(checkout.id).toBe(toGlobalId("Checkout", checkout.token));
    expect(checkout.subtotalPrice).toEqual({
      net: { amount: 2000 },
      gross: { amount: 2000 },
      tax: { amount: 0 },
      currency: "MNT",
    });

    const added = payload(
      await client.gql(ADD, {
        id: checkout.id,
        lines: [
          { variantId: boots, quantity: 1 },
          { variantId: socks, quantity: 4 },
        ],
      }),
      "checkoutLinesAdd",
    );
    expect(added.errors).toEqual([]);
    expect(added.checkout?.quantity).toBe(7);
    expect(added.checkout?.totalPrice.gross).toEqual({ amount: 4000, currency: "MNT" });
    const bootsLine = added.checkout?.lines.find((line) => line.variant.id === boots);
    const socksLine = added.checkout?.lines.find((line) => line.variant.id === socks);
    expect(bootsLine?.quantity).toBe(3);
    expect(socksLine?.totalPrice.gross.amount).toBe(1000);

    const updated = payload(
      await client.gql(UPDATE, {
        id: checkout.id,
        lines: [
          { lineId: bootsLine?.id, quantity: 1 },
          { lineId: socksLine?.id, quantity: 0 },
        ],
      }),
      "checkoutLinesUpdate",
    );
    expect(updated.errors).toEqual([]);
    expect(updated.checkout?.lines.map((line) => line.quantity)).toEqual([1]);
    expect(updated.checkout?.subtotalPrice.gross.amount).toBe(1000);

    const deleted = payload(
      await client.gql(DELETE, { id: checkout.id, linesIds: [bootsLine?.id] }),
      "checkoutLinesDelete",
    );
    expect(deleted.checkout?.lines).toEqual([]);
    expect(deleted.checkout?.totalPrice.gross.amount).toBe(0);

    const emailed = payload(
      await client.gql(EMAIL, { id: checkout.id, email: " buyer@example.com " }),
      "checkoutEmailUpdate",
    );
    expect(emailed.checkout?.email).toBe("buyer@example.com");

    const read = await client.gql(QUERY, { id: checkout.id });
    const readCheckout = read.body.data?.checkout as CheckoutData | null | undefined;
    expect(readCheckout?.email).toBe("buyer@example.com");
  });

  it("reports errors with global variant and line IDs", async () => {
    const boots = await seedVariant(1000, 1);

    const tooMany = payload(
      await client.gql(CREATE, { input: { lines: [{ variantId: boots, quantity: 2 }] } }),
      "checkoutCreate",
    );
    expect(tooMany.checkout).toBeNull();
    expect(tooMany.errors).toEqual([
      {
        field: "quantity",
        code: "INSUFFICIENT_STOCK",
        message: expect.stringContaining("Only 1 remaining in stock."),
        variants: [boots],
        lines: null,
      },
    ]);

    const created = payload(await client.gql(CREATE, { input: { lines: [] } }), "checkoutCreate");
    const id = created.checkout?.id;
    const unknownLine = toGlobalId("CheckoutLine", crypto.randomUUID());
    const missing = payload(
      await client.gql(UPDATE, { id, lines: [{ lineId: unknownLine, quantity: 1 }] }),
      "checkoutLinesUpdate",
    );
    expect(missing.errors).toMatchObject([
      { field: "lineId", code: "NOT_FOUND", lines: [unknownLine] },
    ]);
  });

  it("returns null for an unknown checkout and a top-level error when writing to it", async () => {
    const unknown = toGlobalId("Checkout", crypto.randomUUID());

    const read = await client.gql(QUERY, { id: unknown });
    expect(read.body.errors).toBeUndefined();
    expect(read.body.data?.checkout).toBeNull();

    const write = await client.gql(EMAIL, { id: unknown, email: "buyer@example.com" });
    expect(write.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '${JSON.stringify([unknown])}'.`,
    );
  });
});
