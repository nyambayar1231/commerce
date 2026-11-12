import { closeDb, getDb, schema } from "@commerce/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  completeCheckout,
  createCheckout,
  createShippingMethod,
  initializeCheckoutTransaction,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
} from "../checkout/index.ts";
import { type EmailMessage, stopJobQueue } from "../jobs/index.ts";
import { DUMMY_GATEWAY_ID } from "../payments/index.ts";
import {
  getOrderLinesByOrderIds,
  orderConfirmationHandler,
  orderConfirmationQueue,
  renderOrderConfirmation,
} from "./index.ts";

// The order confirmation email (PLAN M8.2): checkout completion adds exactly one job inside its
// transaction, and the job renders Saleor's "Order #N details" from the stored order.
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", "order", checkout, product, shipping_method, allocation, payment_transaction CASCADE',
  );
});

afterAll(async () => {
  await stopJobQueue();
  await closeDb();
});

const address = {
  firstName: "Bat",
  lastName: "Dorj",
  streetAddress1: "Peace Ave 1",
  city: "Ulaanbaatar",
  postalCode: "14200",
  country: "MN",
};

/** A checkout ready to complete: 2 × 1,000 MNT boots + 500 shipping, paid. */
async function readyCheckout(productName = "Boots") {
  const [product] = await db
    .insert(schema.product)
    .values({ name: productName, slug: `p-${crypto.randomUUID()}`, isPublished: true })
    .returning();
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product?.id ?? "",
      name: "42",
      sku: `B-${crypto.randomUUID()}`,
      priceAmount: 1000,
      currency: "MNT",
      trackInventory: false,
    })
    .returning();
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error("no shipping");
  const created = await createCheckout(db, {
    lines: [{ variantId: variant?.id ?? "", quantity: 2 }],
    email: "buyer@example.com",
  });
  if (!created.ok) throw new Error("no checkout");
  const id = created.checkout.id;
  await updateCheckoutAddress(db, id, "SHIPPING", address);
  await updateCheckoutAddress(db, id, "BILLING", address);
  await updateCheckoutDeliveryMethod(db, id, method.shippingMethod.id);
  return id;
}

const jobsFor = async (orderId: string) =>
  db.execute<{ state: string }>(
    sql`SELECT state FROM pgboss.job WHERE name = ${orderConfirmationQueue.name} AND data->>'orderId' = ${orderId}`,
  );

describe("checkoutComplete", () => {
  it("adds one confirmation job with the order, and none on a retry", async () => {
    const id = await readyCheckout();
    await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });

    const placed = await completeCheckout(db, id);
    if (!placed.ok) throw new Error("not placed");
    expect(await jobsFor(placed.order.id)).toEqual([{ state: "created" }]);

    const retry = await completeCheckout(db, id);
    expect(retry).toMatchObject({ ok: true, created: false });
    expect(await jobsFor(placed.order.id)).toHaveLength(1);
  });

  it("adds no job when the checkout can't be completed", async () => {
    const id = await readyCheckout();
    // pg-boss's tables aren't truncated between tests, so compare the queue before and after.
    const count = async () =>
      (
        await db.execute<{ count: number }>(
          sql`SELECT count(*)::int AS count FROM pgboss.job WHERE name = ${orderConfirmationQueue.name}`,
        )
      )[0]?.count;
    const before = await count();
    // Not paid: completion refuses and its transaction adds nothing.
    expect(await completeCheckout(db, id)).toMatchObject({ ok: false });
    expect(await count()).toBe(before);
  });
});

describe("the confirmation email", () => {
  it("is sent to the order's email by the worker's handler", async () => {
    const id = await readyCheckout("Boots <b>& co</b>");
    await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
    const placed = await completeCheckout(db, id);
    if (!placed.ok) throw new Error("not placed");
    const sent: EmailMessage[] = [];

    await orderConfirmationHandler.handle(
      { orderId: placed.order.id },
      { db, mailer: { send: async (message) => void sent.push(message) } },
    );

    expect(sent).toHaveLength(1);
    const [message] = sent;
    expect(message?.to).toBe("buyer@example.com");
    expect(message?.subject).toBe(`Order #${placed.order.number} details`);
    expect(message?.text).toContain("Boots <b>& co</b> (42) × 2: MNT 1,000 each, MNT 2,000");
    expect(message?.html).toContain("Boots &lt;b&gt;&amp; co&lt;/b&gt; (42)");
    expect(message?.html).not.toContain("<b>& co</b>");
  });

  it("renders Saleor's wording, summary and addresses", async () => {
    const id = await readyCheckout();
    await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
    const placed = await completeCheckout(db, id);
    if (!placed.ok) throw new Error("not placed");
    const lines = await getOrderLinesByOrderIds(db, [placed.order.id]);

    const { text } = renderOrderConfirmation(placed.order, lines, "Hantesi-Mongolia");

    expect(text).toBe(
      [
        "Hi!",
        "",
        "Thank you for your order. Below is the list of ordered products.",
        "",
        "Boots (42) × 2: MNT 1,000 each, MNT 2,000",
        "",
        "Subtotal: MNT 2,000",
        "Shipping: MNT 500",
        "Taxes (included): MNT 0",
        "Total: MNT 2,500",
        "",
        "Billing address:",
        "Bat Dorj",
        "Peace Ave 1",
        "14200 Ulaanbaatar",
        "Mongolia",
        "",
        "Shipping address:",
        "Bat Dorj",
        "Peace Ave 1",
        "14200 Ulaanbaatar",
        "Mongolia",
        "",
        "Sincerely, Hantesi-Mongolia",
      ].join("\n"),
    );
  });
});
