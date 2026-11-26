import { closeDb, getDb, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyGatewayStatus,
  createFakeGateway,
  createGatewayRegistry,
  dummyGateway,
  type FakeGateway,
  type GatewayRegistry,
  getEventsByTransactionIds,
  getTransaction,
  processInitializeRequest,
  processRefundRequest,
  reconcilePayments,
  recordInitializeRequest,
  recordRefundRequest,
} from "./index.ts";

// The reconciliation job (ADR-0016 §6) against the real (test) database: each kind of unfinished
// work is finished, nothing is done twice, and young work is left to its webhook.
const db = getDb();
let checkoutId: string;
let fake: FakeGateway;
let gateways: GatewayRegistry;

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE checkout CASCADE");
  const [checkout] = await db.insert(schema.checkout).values({ currency: "MNT" }).returning();
  if (!checkout) throw new Error("no checkout");
  checkoutId = checkout.id;
  fake = createFakeGateway();
  gateways = createGatewayRegistry([dummyGateway, fake]);
});

afterAll(async () => {
  await closeDb();
});

const MINUTE = 60_000;
/** "Now" for the job: later than everything the test made. */
const later = (minutes: number) => new Date(Date.now() + minutes * MINUTE);

async function requested() {
  const recorded = await db.transaction((tx) =>
    recordInitializeRequest(tx, {
      checkoutId,
      currency: "MNT",
      amount: 5000,
      action: "CHARGE",
      gateway: fake,
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  if (!recorded.ok) throw new Error("not recorded");
  return recorded;
}

async function waiting() {
  const recorded = await requested();
  return (
    await processInitializeRequest(db, fake, recorded.transaction, recorded.request, {
      gatewayData: null,
      returnUrl: null,
    })
  ).transaction;
}

const types = async (id: string) =>
  (await getEventsByTransactionIds(db, [id])).map((event) => event.type);

const queued = async (id: string) =>
  Number(
    (
      await db.execute<{ count: string }>(
        sql`SELECT count(*) FROM pgboss.job WHERE name = 'checkout-paid' AND data->>'checkoutId' = ${id}`,
      )
    )[0]?.count ?? 0,
  );

describe("reconcilePayments", () => {
  it("reads a payment whose webhook never came and queues its order", async () => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status: "succeeded" });

    // Young work is left to its webhook.
    expect((await reconcilePayments(db, gateways)).paymentsRead).toBe(0);
    const report = await reconcilePayments(db, gateways, later(2));
    expect(report).toMatchObject({ paymentsRead: 1, failures: 0 });
    expect((await getTransaction(db, transaction.id))?.chargedAmount).toBe(5000);
    expect(await queued(checkoutId)).toBeGreaterThanOrEqual(1);

    // Settled: the next run has nothing to read.
    expect((await reconcilePayments(db, gateways, later(4))).paymentsRead).toBe(0);
  });

  it("closes a request the gateway never answered, but only after 30 minutes", async () => {
    const { transaction } = await requested();
    expect((await reconcilePayments(db, gateways, later(10))).requestsAbandoned).toBe(0);
    expect((await reconcilePayments(db, gateways, later(31))).requestsAbandoned).toBe(1);
    expect(await getTransaction(db, transaction.id)).toMatchObject({ chargePendingAmount: 0 });
    expect(await types(transaction.id)).toEqual(["CHARGE_REQUEST", "CHARGE_FAILURE"]);
  });

  it("asks again for a refund the gateway never answered, with the same key", async () => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status: "succeeded" });
    await applyGatewayStatus(db, gateways, transaction.id);
    const { request } = await db.transaction(async (tx) => {
      const row = await getTransaction(tx, transaction.id);
      if (!row) throw new Error("gone");
      return recordRefundRequest(tx, row, 2000);
    });
    fake.failNext("refund");
    await processRefundRequest(db, gateways, transaction.id, request.id);

    const report = await reconcilePayments(db, gateways, later(2));
    expect(report.refundsRetried).toBe(1);
    expect(await getTransaction(db, transaction.id)).toMatchObject({
      refundedAmount: 2000,
      refundPendingAmount: 0,
    });
    const refundCalls = fake.calls.filter((call) => call.method === "refund");
    expect(
      refundCalls.map((call) => (call.input as { idempotencyKey: string }).idempotencyKey),
    ).toEqual([request.id, request.id]);
    expect((await reconcilePayments(db, gateways, later(4))).refundsRetried).toBe(0);
  });

  it("settles a refund the provider finished later", async () => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status: "succeeded" });
    await applyGatewayStatus(db, gateways, transaction.id);
    fake.nextRefund = () => ({ status: "manual_required", refundReference: "re_7", message: "" });
    const { request } = await db.transaction(async (tx) => {
      const row = await getTransaction(tx, transaction.id);
      if (!row) throw new Error("gone");
      return recordRefundRequest(tx, row, 2000);
    });
    await processRefundRequest(db, gateways, transaction.id, request.id);

    expect((await reconcilePayments(db, gateways, later(2))).refundsRead).toBe(0);
    fake.setRefund("re_7", { status: "succeeded" });
    expect((await reconcilePayments(db, gateways, later(4))).refundsRead).toBe(1);
    expect(await getTransaction(db, transaction.id)).toMatchObject({
      refundedAmount: 2000,
      refundPendingAmount: 0,
    });
    expect((await types(transaction.id)).slice(-2)).toEqual(["REFUND_PENDING", "REFUND_SUCCESS"]);
  });

  it("queues paid checkouts that have no order yet, and not refunded ones", async () => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status: "succeeded" });
    await applyGatewayStatus(db, gateways, transaction.id);
    await db.$client.unsafe("DELETE FROM pgboss.job WHERE name = 'checkout-paid'");

    expect((await reconcilePayments(db, gateways, later(3))).checkoutsQueued).toBe(1);
    expect(await queued(checkoutId)).toBe(1);

    // Fully refunded: nothing left to complete.
    await db
      .update(schema.paymentTransaction)
      .set({ refundedAmount: 5000 })
      .where(eq(schema.paymentTransaction.id, transaction.id));
    expect((await reconcilePayments(db, gateways, later(5))).checkoutsQueued).toBe(0);
  });

  it("keeps going when one gateway call fails", async () => {
    const first = await waiting();
    const second = await waiting();
    fake.setStatus(second.pspReference, { status: "succeeded" });
    fake.failNext("fetchStatus");
    const report = await reconcilePayments(db, gateways, later(2));
    expect(report.failures).toBe(1);
    expect(report.paymentsRead).toBe(1);
    expect((await getTransaction(db, first.id))?.chargedAmount).toBe(0);
  });
});
