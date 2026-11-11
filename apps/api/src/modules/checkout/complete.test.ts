import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { updateProductVariant } from "../catalog/index.ts";
import { updateVariantStocks } from "../inventory/index.ts";
import { getOrderLinesByOrderIds } from "../orders/index.ts";
import { DUMMY_GATEWAY_ID } from "../payments/index.ts";
import {
  completeCheckout,
  createCheckout,
  createShippingMethod,
  getCheckout,
  initializeCheckoutTransaction,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
  updateCheckoutEmail,
} from "./index.ts";

// checkoutComplete against the real (test) database, including real parallel transactions
// (ARCHITECTURE §5.4, §6: overselling, double submit, deadlocks).
const db = getDb();
let warehouseId: string;
let shippingMethodId: string;

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "order", checkout, product, shipping_method, allocation, payment_transaction CASCADE',
  );
  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  warehouseId = warehouse.id;
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error(JSON.stringify(method.errors));
  shippingMethodId = method.shippingMethod.id;
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

/** A published variant at `price`; tracked with `stock` units when given, untracked otherwise. */
async function seedVariant(price: number, stock?: number) {
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: `Boots ${suffix.slice(0, 4)}`, slug: `boots-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product.id,
      name: "Size 42",
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
  return variant;
}

/** A checkout with every detail completion needs, paid in full unless `pay` is false. */
async function readyCheckout(lines: { variantId: string; quantity: number }[], pay = true) {
  const created = await createCheckout(db, { lines, email: "buyer@example.com" });
  if (!created.ok) throw new Error(JSON.stringify(created.errors));
  const id = created.checkout.id;
  await updateCheckoutAddress(db, id, "SHIPPING", ADDRESS);
  await updateCheckoutAddress(db, id, "BILLING", ADDRESS);
  await updateCheckoutDeliveryMethod(db, id, shippingMethodId);
  if (pay) {
    const paid = await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
    if (!paid.ok) throw new Error(JSON.stringify(paid.errors));
  }
  return id;
}

async function stockOf(variantId: string) {
  const [stock] = await db.select().from(schema.stock).where(eq(schema.stock.variantId, variantId));
  return stock;
}

describe("completeCheckout", () => {
  it("creates an order snapshot, allocates stock and moves the payment", async () => {
    const boots = await seedVariant(1000, 5);
    const socks = await seedVariant(250);
    const id = await readyCheckout([
      { variantId: boots.id, quantity: 2 },
      { variantId: socks.id, quantity: 4 },
    ]);

    const result = await completeCheckout(db, id);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.created).toBe(true);
    expect(result.order).toMatchObject({
      status: "UNFULFILLED",
      userEmail: "buyer@example.com",
      shippingMethodName: "Standard",
      subtotalAmount: 3000,
      shippingPriceAmount: 500,
      totalAmount: 3500,
      currency: "MNT",
      checkoutToken: id,
      shippingAddress: { city: "Ulaanbaatar", country: "MN" },
    });

    const lines = await getOrderLinesByOrderIds(db, [result.order.id]);
    expect(
      lines.map((line) => [
        line.productSku,
        line.variantName,
        line.quantity,
        line.totalPriceAmount,
      ]),
    ).toEqual([
      [boots.sku, "Size 42", 2, 2000],
      [socks.sku, "Size 42", 4, 1000],
    ]);

    // Only the tracked variant is allocated.
    expect(await stockOf(boots.id)).toMatchObject({ quantity: 5, quantityAllocated: 2 });
    const allocations = await db.select().from(schema.allocation);
    expect(allocations).toHaveLength(1);
    expect(allocations[0]?.quantityAllocated).toBe(2);

    const transactions = await db.select().from(schema.paymentTransaction);
    expect(transactions.map((t) => [t.checkoutId, t.orderId])).toEqual([[null, result.order.id]]);
    expect((await getCheckout(db, id))?.completedOrderId).toBe(result.order.id);
    const events = await db.select().from(schema.orderEvent);
    expect(events.map((event) => event.type)).toEqual(["PLACED"]);
  });

  it("returns the same order when completed again, and the order keeps its prices", async () => {
    const boots = await seedVariant(1000, 5);
    const id = await readyCheckout([{ variantId: boots.id, quantity: 1 }]);
    const first = await completeCheckout(db, id);
    if (!first.ok) throw new Error(JSON.stringify(first.errors));

    await updateProductVariant(db, boots.id, { price: "9999" });
    const again = await completeCheckout(db, id);
    expect(again).toMatchObject({
      ok: true,
      created: false,
      order: { id: first.order.id, totalAmount: 1500 },
    });
    expect(await db.select().from(schema.order)).toHaveLength(1);
    expect(await stockOf(boots.id)).toMatchObject({ quantityAllocated: 1 });
  });

  it("reports every missing detail at once", async () => {
    const created = await createCheckout(db, { lines: [] });
    if (!created.ok) throw new Error("no checkout");
    const result = await completeCheckout(db, created.checkout.id);
    expect(result.ok ? [] : result.errors.map((error) => error.code)).toEqual([
      "NO_LINES",
      "EMAIL_NOT_SET",
      "SHIPPING_ADDRESS_NOT_SET",
      "SHIPPING_METHOD_NOT_SET",
      "BILLING_ADDRESS_NOT_SET",
    ]);
  });

  it("rejects a switched-off shipping method and an unpublished product", async () => {
    const boots = await seedVariant(1000);
    const id = await readyCheckout([{ variantId: boots.id, quantity: 1 }]);
    await db.update(schema.shippingMethod).set({ isActive: false });
    await db.update(schema.product).set({ isPublished: false });

    const result = await completeCheckout(db, id);
    expect(result).toMatchObject({
      ok: false,
      errors: [
        { code: "INVALID_SHIPPING_METHOD" },
        { code: "PRODUCT_NOT_PUBLISHED", variants: [boots.id] },
      ],
    });
  });

  it("requires the transactions to cover the fresh total", async () => {
    const boots = await seedVariant(1000);
    const unpaid = await readyCheckout([{ variantId: boots.id, quantity: 1 }], false);
    expect(await completeCheckout(db, unpaid)).toMatchObject({
      ok: false,
      errors: [{ code: "CHECKOUT_NOT_FULLY_PAID" }],
    });

    // Paid at the old price, then the price went up: the payment no longer covers the total.
    const paid = await readyCheckout([{ variantId: boots.id, quantity: 1 }]);
    await updateProductVariant(db, boots.id, { price: "2000" });
    expect(await completeCheckout(db, paid)).toMatchObject({
      ok: false,
      errors: [{ code: "CHECKOUT_NOT_FULLY_PAID" }],
    });
    expect(await db.select().from(schema.order)).toHaveLength(0);
  });

  it("rejects writes to the checkout once it is completed", async () => {
    const boots = await seedVariant(1000);
    const id = await readyCheckout([{ variantId: boots.id, quantity: 1 }]);
    await completeCheckout(db, id);
    expect(await updateCheckoutEmail(db, id, "other@example.com")).toMatchObject({
      ok: false,
      errors: [{ field: "id", code: "INVALID" }],
    });
  });
});

describe("completeCheckout under concurrency", () => {
  it("sells the last unit once when two buyers complete at the same time", async () => {
    for (let round = 0; round < 10; round++) {
      const lastUnit = await seedVariant(1000, 1);
      const [first, second] = await Promise.all([
        readyCheckout([{ variantId: lastUnit.id, quantity: 1 }]),
        readyCheckout([{ variantId: lastUnit.id, quantity: 1 }]),
      ]);

      const results = await Promise.all([
        completeCheckout(db, first),
        completeCheckout(db, second),
      ]);
      const placed = results.filter((result) => result.ok);
      const refused = results.filter((result) => !result.ok);
      expect(placed).toHaveLength(1);
      expect(refused).toMatchObject([{ errors: [{ code: "INSUFFICIENT_STOCK" }] }]);
      expect(await stockOf(lastUnit.id)).toMatchObject({ quantity: 1, quantityAllocated: 1 });
    }
  });

  it("creates one order for a double submit", async () => {
    const boots = await seedVariant(1000, 10);
    const id = await readyCheckout([{ variantId: boots.id, quantity: 2 }]);

    const results = await Promise.all(Array.from({ length: 5 }, () => completeCheckout(db, id)));
    const orderIds = new Set(results.map((result) => (result.ok ? result.order.id : null)));
    expect(orderIds.size).toBe(1);
    expect(results.filter((result) => result.ok && result.created)).toHaveLength(1);
    expect(await db.select().from(schema.order)).toHaveLength(1);
    expect(await stockOf(boots.id)).toMatchObject({ quantityAllocated: 2 });
  });

  it("does not deadlock with stock updates on the same variant", async () => {
    const boots = await seedVariant(1000, 100);
    const ids = await Promise.all(
      Array.from({ length: 10 }, () => readyCheckout([{ variantId: boots.id, quantity: 1 }])),
    );

    const outcomes = await Promise.allSettled(
      ids.flatMap((id, index) => [
        completeCheckout(db, id),
        updateVariantStocks(db, boots.id, [{ warehouseId, quantity: 100 + index }]),
      ]),
    );
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(rejected).toEqual([]);
    expect(await stockOf(boots.id)).toMatchObject({ quantityAllocated: 10 });
  });
});
