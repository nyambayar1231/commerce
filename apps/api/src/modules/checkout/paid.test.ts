import { closeDb, getDb, schema } from "@commerce/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testGateways } from "../../../test/payments.ts";
import { updateVariantStocks } from "../inventory/index.ts";
import type { EmailMessage } from "../jobs/index.ts";
import {
  applyGatewayStatus,
  createFakeGateway,
  FAKE_GATEWAY_ID,
  type FakeGateway,
  type GatewayRegistry,
  getTransactionsByCheckoutIds,
  getTransactionsByOrderIds,
} from "../payments/index.ts";
import {
  completePaidCheckout,
  createCheckout,
  createPaidCheckoutHandler,
  createShippingMethod,
  getCheckout,
  initializeCheckoutTransaction,
  readStaffNotificationEmails,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
} from "./index.ts";

// Orders made by the server once a checkout is paid through a redirect gateway (ADR-0016 §5, §7),
// against the real (test) database with the fake gateway standing in for Wire.
const db = getDb();
let warehouseId: string;
let shippingMethodId: string;
let fake: FakeGateway;
let gateways: GatewayRegistry;

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", "order", checkout, product, shipping_method, allocation, payment_transaction CASCADE',
  );
  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  warehouseId = warehouse.id;
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error(JSON.stringify(method.errors));
  shippingMethodId = method.shippingMethod.id;
  fake = createFakeGateway();
  gateways = testGateways(fake);
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

async function seedVariant(price: number, stock: number) {
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: `Boots ${suffix.slice(0, 4)}`, slug: `boots-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({ productId: product.id, priceAmount: price, currency: "MNT", trackInventory: true })
    .returning();
  if (!variant) throw new Error("no variant");
  await db.insert(schema.stock).values({ warehouseId, variantId: variant.id, quantity: stock });
  return variant;
}

/** A complete checkout for `quantity` × a 1000 variant with 500 shipping (total 1000q + 500). */
async function readyCheckout(quantity = 1, stock = 5) {
  const boots = await seedVariant(1000, stock);
  const created = await createCheckout(db, {
    lines: [{ variantId: boots.id, quantity }],
    email: "buyer@example.com",
  });
  if (!created.ok) throw new Error(JSON.stringify(created.errors));
  const id = created.checkout.id;
  await updateCheckoutAddress(db, id, "SHIPPING", ADDRESS);
  await updateCheckoutAddress(db, id, "BILLING", ADDRESS);
  await updateCheckoutDeliveryMethod(db, id, shippingMethodId);
  return { id, variantId: boots.id };
}

/** Starts a redirect payment and has the shopper pay it (the gateway reports success). */
async function payThroughGateway(checkoutId: string, idempotencyKey?: string, amount?: string) {
  const started = await initializeCheckoutTransaction(db, gateways, checkoutId, {
    gatewayId: FAKE_GATEWAY_ID,
    idempotencyKey,
    amount,
  });
  if (!started.ok) throw new Error(JSON.stringify(started.errors));
  return started.transaction;
}

async function settle(transactionId: string, pspReference: string) {
  fake.setStatus(pspReference, { status: "succeeded", chargeReference: `ch_${transactionId}` });
  await applyGatewayStatus(db, gateways, transactionId);
}

const paidJobs = async (key: "checkoutId" | "orderId", id: string) =>
  Number(
    (
      await db.execute<{ count: string }>(
        sql`SELECT count(*) FROM pgboss.job WHERE name = 'checkout-paid' AND data->>${key} = ${id}`,
      )
    )[0]?.count ?? 0,
  );

describe("completePaidCheckout", () => {
  it("makes the order once the payment is reported, and queues itself when it is", async () => {
    const { id } = await readyCheckout();
    const transaction = await payThroughGateway(id);
    expect(await paidJobs("checkoutId", id)).toBe(0);
    await settle(transaction.id, transaction.pspReference);
    // Recording the payment queued the completion in the same database transaction.
    expect(await paidJobs("checkoutId", id)).toBe(1);

    const result = await completePaidCheckout(db, gateways, id);
    expect(result).toMatchObject({ kind: "completed", overpaymentRefunded: 0 });
    const checkout = await getCheckout(db, id);
    expect(checkout?.completedOrderId).toBe(result.kind === "completed" ? result.orderId : null);
    // Running again (a retried job) changes nothing.
    expect(await completePaidCheckout(db, gateways, id)).toEqual(result);
  });

  it("does nothing while the checkout isn't fully paid", async () => {
    const { id } = await readyCheckout();
    await payThroughGateway(id);
    expect(await completePaidCheckout(db, gateways, id)).toEqual({ kind: "not_paid" });
    expect((await getCheckout(db, id))?.completedOrderId).toBeNull();
  });

  it("refunds a paid checkout that can't become an order, once", async () => {
    const { id, variantId } = await readyCheckout(2, 5);
    const transaction = await payThroughGateway(id);
    // Sold out while the shopper was paying.
    await updateVariantStocks(db, variantId, [{ warehouseId, quantity: 1 }]);
    await settle(transaction.id, transaction.pspReference);

    const result = await completePaidCheckout(db, gateways, id);
    expect(result).toMatchObject({
      kind: "refunded",
      amount: 2500,
      errors: [{ code: "INSUFFICIENT_STOCK" }],
    });
    const [after] = await getTransactionsByCheckoutIds(db, [id]);
    expect(after).toMatchObject({
      chargedAmount: 2500,
      refundedAmount: 2500,
      refundPendingAmount: 0,
    });
    expect(fake.calls.filter((call) => call.method === "refund")).toHaveLength(1);

    expect(await completePaidCheckout(db, gateways, id)).toEqual({ kind: "not_paid" });
    expect(fake.calls.filter((call) => call.method === "refund")).toHaveLength(1);
  });

  it("refunds an overpayment exactly once, even when two jobs run at the same time", async () => {
    const { id } = await readyCheckout();
    // Two attempts, both paid (the shopper paid the first before it could be canceled).
    const first = await payThroughGateway(id, "a");
    fake.failNext("cancel");
    const second = await payThroughGateway(id, "b");
    await settle(first.id, first.pspReference);
    await settle(second.id, second.pspReference);

    const results = await Promise.all([
      completePaidCheckout(db, gateways, id),
      completePaidCheckout(db, gateways, id),
    ]);
    const orderId = results[0]?.kind === "completed" ? results[0].orderId : "";
    const transactions = await getTransactionsByOrderIds(db, [orderId]);
    const refunded = transactions.reduce((sum, t) => sum + t.refundedAmount, 0);
    expect(refunded).toBe(1500);
    expect(
      results.map((r) => (r.kind === "completed" ? r.overpaymentRefunded : -1)).sort(),
    ).toEqual([0, 1500]);
  });

  it("refunds a late payment on an attempt that moved to the order", async () => {
    const { id } = await readyCheckout();
    const first = await payThroughGateway(id, "a");
    fake.failNext("cancel");
    const second = await payThroughGateway(id, "b");
    await settle(second.id, second.pspReference);
    const done = await completePaidCheckout(db, gateways, id);
    if (done.kind !== "completed") throw new Error("not completed");

    // The first attempt is paid after the order was made: it now belongs to the order.
    await settle(first.id, first.pspReference);
    expect(await paidJobs("orderId", done.orderId)).toBe(1);
    const handler = createPaidCheckoutHandler(gateways, []);
    await handler.handle({ orderId: done.orderId }, { db, mailer: { send: async () => {} } });
    const transactions = await getTransactionsByOrderIds(db, [done.orderId]);
    expect(transactions.reduce((sum, t) => sum + t.refundedAmount, 0)).toBe(1500);
  });
});

describe("the paid-checkout job's staff email", () => {
  it("tells staff about a refunded checkout", async () => {
    const { id, variantId } = await readyCheckout(2, 5);
    const transaction = await payThroughGateway(id);
    await updateVariantStocks(db, variantId, [{ warehouseId, quantity: 0 }]);
    await settle(transaction.id, transaction.pspReference);

    const sent: EmailMessage[] = [];
    const handler = createPaidCheckoutHandler(gateways, ["owner@example.com"]);
    await handler.handle(
      { checkoutId: id },
      { db, mailer: { send: async (m) => void sent.push(m) } },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "owner@example.com" });
    expect(sent[0]?.text).toContain("buyer@example.com");
    expect(sent[0]?.text).toContain("Insufficient stock");
  });

  it("reads STAFF_NOTIFICATION_EMAILS", () => {
    expect(readStaffNotificationEmails({})).toEqual([]);
    expect(readStaffNotificationEmails({ STAFF_NOTIFICATION_EMAILS: "a@b.mn, c@d.mn" })).toEqual([
      "a@b.mn",
      "c@d.mn",
    ]);
    expect(() => readStaffNotificationEmails({ STAFF_NOTIFICATION_EMAILS: "nope" })).toThrow(
      /not an email address/,
    );
  });
});

describe("transactionInitialize with a gateway that settles later", () => {
  it("refuses a checkout that couldn't become an order", async () => {
    const boots = await seedVariant(1000, 5);
    const created = await createCheckout(db, { lines: [{ variantId: boots.id, quantity: 1 }] });
    if (!created.ok) throw new Error("no checkout");
    const result = await initializeCheckoutTransaction(db, gateways, created.checkout.id, {
      gatewayId: FAKE_GATEWAY_ID,
    });
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["email", "shippingAddress", "shippingMethod", "billingAddress"]),
    );
    expect(result.errors.every((error) => error.code === "INVALID")).toBe(true);
    expect(fake.calls).toEqual([]);
  });

  it("refuses when the stock is already gone", async () => {
    const { id, variantId } = await readyCheckout(2, 5);
    await updateVariantStocks(db, variantId, [{ warehouseId, quantity: 1 }]);
    const result = await initializeCheckoutTransaction(db, gateways, id, {
      gatewayId: FAKE_GATEWAY_ID,
    });
    expect(result).toMatchObject({ ok: false, errors: [{ field: "quantity", code: "INVALID" }] });
  });

  it("still lets the dummy gateway pay an incomplete checkout (Saleor's rule)", async () => {
    const boots = await seedVariant(1000, 5);
    const created = await createCheckout(db, { lines: [{ variantId: boots.id, quantity: 1 }] });
    if (!created.ok) throw new Error("no checkout");
    const result = await initializeCheckoutTransaction(db, gateways, created.checkout.id, {
      gatewayId: "saleor.io.dummy-payment-app",
    });
    expect(result.ok).toBe(true);
  });
});
