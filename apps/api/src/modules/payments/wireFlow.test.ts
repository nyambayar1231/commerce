import { closeDb, getDb, schema } from "@commerce/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createFakeWire,
  FAKE_WIRE_KEY,
  FAKE_WIRE_SECRET,
  type FakeWire,
} from "../../../test/fakeWire.ts";
import { createStaff, createTestClient } from "../../../test/graphql.ts";
import { testGateways } from "../../../test/payments.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import {
  completePaidCheckout,
  createCheckout,
  createShippingMethod,
  getCheckout,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
} from "../checkout/index.ts";
import {
  createWireGateway,
  type GatewayRegistry,
  getTransactionsByCheckoutIds,
  getTransactionsByOrderIds,
  WIRE_GATEWAY_ID,
} from "./index.ts";

// A Wire payment end to end through the app and the real (test) database, with the fake Wire API
// (ADR-0016): transactionInitialize → the shopper pays on Wire's page → Wire's signed
// notification → the payment is read again and recorded → the order is made; then a refund that
// Wire completes by hand and confirms later.
const db = getDb();
let wire: FakeWire;
let gateways: GatewayRegistry;
let client: ReturnType<typeof createTestClient>;
let checkoutId: string;

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", "order", checkout, product, shipping_method, allocation, payment_transaction, payment_gateway_event CASCADE',
  );
  wire = createFakeWire();
  gateways = testGateways(
    createWireGateway(
      {
        apiKey: FAKE_WIRE_KEY,
        webhookSecret: FAKE_WIRE_SECRET,
        apiUrl: "https://api.wire.test/v1",
      },
      { fetchImpl: wire.fetch },
    ),
  );
  client = createTestClient(db, gateways, FAKE_WIRE_SECRET);

  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("no warehouse");
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: `boots-${crypto.randomUUID()}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({ productId: product.id, priceAmount: 45000, currency: "MNT", trackInventory: true })
    .returning();
  if (!variant) throw new Error("no variant");
  await db
    .insert(schema.stock)
    .values({ warehouseId: warehouse.id, variantId: variant.id, quantity: 3 });
  const method = await createShippingMethod(db, { name: "Courier", price: "5000" });
  if (!method.ok) throw new Error("no shipping method");
  const created = await createCheckout(db, {
    lines: [{ variantId: variant.id, quantity: 1 }],
    email: "buyer@example.com",
  });
  if (!created.ok) throw new Error("no checkout");
  checkoutId = created.checkout.id;
  const address = {
    firstName: "Bat",
    lastName: "Dorj",
    streetAddress1: "Peace Ave 1",
    city: "UB",
    country: "MN",
  };
  await updateCheckoutAddress(db, checkoutId, "SHIPPING", address);
  await updateCheckoutAddress(db, checkoutId, "BILLING", address);
  await updateCheckoutDeliveryMethod(db, checkoutId, method.shippingMethod.id);
});

afterAll(async () => {
  await closeDb();
});

const INITIALIZE = `mutation($id: ID!, $gateway: PaymentGatewayToInitialize!) {
  transactionInitialize(id: $id, paymentGateway: $gateway) {
    transaction { id pspReference }
    transactionEvent { type }
    data
    errors { field code message }
  }
}`;

async function startPayment() {
  const { body } = await client.gql(INITIALIZE, {
    id: toGlobalId("Checkout", checkoutId),
    gateway: { id: WIRE_GATEWAY_ID, data: { returnUrl: "http://localhost:3000/checkout/return" } },
  });
  const result = body.data?.transactionInitialize as {
    transaction: { pspReference: string };
    transactionEvent: { type: string };
    data: { url: string };
    errors: unknown[];
  };
  expect(result.errors).toEqual([]);
  return result;
}

const postWebhook = (body: string, signature: string) =>
  client.fetch("/webhooks/wire", {
    method: "POST",
    headers: { "content-type": "application/json", "wirepayment-signature": signature },
    body,
  });

describe("a Wire payment end to end", () => {
  it("records the payment from Wire's notification and makes the order", async () => {
    const started = await startPayment();
    expect(started.transactionEvent.type).toBe("CHARGE_ACTION_REQUIRED");
    expect(started.data.url).toMatch(/^https:\/\/pay\.wire\.test\/c\//);
    const intentId = started.transaction.pspReference;
    expect(wire.intents.get(intentId)?.amount).toBe(50000);

    // The shopper pays in their bank app; Wire notifies us.
    const charge = wire.pay(intentId);
    const notification = wire.webhook("payment_intent.succeeded", {
      id: intentId,
      object: "payment_intent",
      status: "succeeded",
      amount: 50000,
      currency: "MNT",
      charge: charge.id,
    });
    const response = await postWebhook(notification.body, notification.signature);
    expect(response.status).toBe(200);

    const [transaction] = await getTransactionsByCheckoutIds(db, [checkoutId]);
    expect(transaction).toMatchObject({
      chargedAmount: 50000,
      chargePendingAmount: 0,
      chargePspReference: charge.id,
    });
    const [stored] = await db.select().from(schema.paymentGatewayEvent);
    expect(stored).toMatchObject({
      provider: WIRE_GATEWAY_ID,
      type: "payment_intent.succeeded",
      rawBody: notification.body,
      processingError: "",
    });
    expect(stored?.processedAt).not.toBeNull();

    // The job the payment queued makes the order.
    const done = await completePaidCheckout(db, gateways, checkoutId);
    expect(done.kind).toBe("completed");
    expect((await getCheckout(db, checkoutId))?.completedOrderId).not.toBeNull();

    // A redelivery is stored once and changes nothing.
    const again = await postWebhook(notification.body, notification.signature);
    expect(await again.text()).toBe("duplicate");
    expect(await db.select().from(schema.paymentGatewayEvent)).toHaveLength(1);
  });

  it("never trusts the notification's body: the payment is read from Wire", async () => {
    const started = await startPayment();
    // A notification claiming success for a payment Wire still has unpaid.
    const lie = wire.webhook("payment_intent.succeeded", {
      id: started.transaction.pspReference,
      object: "payment_intent",
      status: "succeeded",
      amount: 50000,
    });
    expect((await postWebhook(lie.body, lie.signature)).status).toBe(200);
    const [transaction] = await getTransactionsByCheckoutIds(db, [checkoutId]);
    expect(transaction).toMatchObject({ chargedAmount: 0, chargePendingAmount: 50000 });
  });

  it("refuses an unsigned or forged notification and stores nothing", async () => {
    const started = await startPayment();
    wire.pay(started.transaction.pspReference);
    const real = wire.webhook("payment_intent.succeeded", { id: started.transaction.pspReference });
    expect((await postWebhook(real.body, "t=1,v1=00")).status).toBe(400);
    expect(
      (await postWebhook(real.body.replace("succeeded", "canceled"), real.signature)).status,
    ).toBe(400);
    expect((await client.fetch("/webhooks/wire", { method: "GET" })).status).toBe(405);
    expect(await db.select().from(schema.paymentGatewayEvent)).toHaveLength(0);
    const [transaction] = await getTransactionsByCheckoutIds(db, [checkoutId]);
    expect(transaction?.chargedAmount).toBe(0);
  });

  it("answers Wire's endpoint verification ping", async () => {
    const ping = wire.webhook("endpoint.verification", {});
    expect((await postWebhook(ping.body, ping.signature)).status).toBe(200);
  });

  it("is not routed where Wire isn't configured", async () => {
    const plain = createTestClient(db);
    expect((await plain.fetch("/webhooks/wire", { method: "POST", body: "{}" })).status).toBe(404);
  });

  it("settles a refund Wire completes by hand when it confirms it", async () => {
    const started = await startPayment();
    const intentId = started.transaction.pspReference;
    wire.pay(intentId);
    const paid = wire.webhook("payment_intent.succeeded", {
      id: intentId,
      object: "payment_intent",
    });
    await postWebhook(paid.body, paid.signature);
    const done = await completePaidCheckout(db, gateways, checkoutId);
    if (done.kind !== "completed") throw new Error("no order");

    // Staff refund 10 000 from the dashboard; Wire records it for its operations team.
    wire.setRefundOutcome("manual_required");
    const staff = await createStaff(db, ["HANDLE_PAYMENTS"]);
    const [transaction] = await getTransactionsByOrderIds(db, [done.orderId]);
    const { body } = await client.gql(
      `mutation($id: ID!, $amount: Decimal) {
        transactionRequestAction(id: $id, actionType: REFUND, amount: $amount) {
          transaction { refundedAmount { amount } refundPendingAmount { amount } events { type message } }
          errors { code message }
        }
      }`,
      { id: toGlobalId("TransactionItem", transaction?.id ?? ""), amount: "10000" },
      staff.token,
    );
    const refunded = body.data?.transactionRequestAction as {
      transaction: {
        refundedAmount: { amount: number };
        refundPendingAmount: { amount: number };
        events: { type: string; message: string }[];
      };
    };
    expect(refunded.transaction).toMatchObject({
      refundedAmount: { amount: 0 },
      refundPendingAmount: { amount: 10000 },
    });
    expect(refunded.transaction.events.at(-1)).toMatchObject({
      type: "INFO",
      message: "The refund is completed manually by the payment provider.",
    });

    // Later Wire's operations finish it and Wire tells us.
    const [refund] = [...wire.refunds.values()];
    if (!refund) throw new Error("no refund at Wire");
    wire.finishRefund(refund.id, "succeeded");
    const confirmed = wire.webhook("charge.refunded", {
      id: refund.id,
      object: "refund",
      charge: refund.charge,
      amount: 10000,
      status: "succeeded",
    });
    expect((await postWebhook(confirmed.body, confirmed.signature)).status).toBe(200);
    const [after] = await getTransactionsByOrderIds(db, [done.orderId]);
    expect(after).toMatchObject({ refundedAmount: 10000, refundPendingAmount: 0 });
  });
});

it("queues the order with the checkout's id when Wire's notification records the payment", async () => {
  const started = await startPayment();
  wire.pay(started.transaction.pspReference);
  const paid = wire.webhook("payment_intent.succeeded", {
    id: started.transaction.pspReference,
    object: "payment_intent",
  });
  await postWebhook(paid.body, paid.signature);
  const rows = await db.execute<{ data: { checkoutId?: string } }>(
    sql`SELECT data FROM pgboss.job WHERE name = 'checkout-paid' ORDER BY created_on DESC LIMIT 1`,
  );
  expect(rows[0]?.data).toEqual({ checkoutId });
});
