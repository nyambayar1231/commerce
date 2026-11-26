import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyGatewayStatus,
  type ChargeRequestInput,
  cancelOpenAttempts,
  coveredAmounts,
  createFakeGateway,
  createGatewayRegistry,
  dummyGateway,
  type FakeGateway,
  type GatewayRegistry,
  getEventsByTransactionIds,
  getTransaction,
  getTransactionsByCheckoutIds,
  initializeReplay,
  type PaymentGateway,
  type PaymentTransactionRow,
  processInitializeRequest,
  processRefundRequest,
  recordInitializeRequest,
  recordRefundRequest,
  refundableAmount,
} from "./index.ts";

// Payment transactions against the real (test) database (M5.3, ADR-0016): the dummy gateway as
// before, a redirect gateway (the fake one, shaped like Wire) whose result arrives later, status
// application, cancellation of older attempts, refunds with every gateway answer, and the
// payment tables' invariants.
const db = getDb();
let checkoutId: string;
let fake: FakeGateway;
let gateways: GatewayRegistry;

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE checkout CASCADE");
  // A bare checkout row: this module writes only payment tables, so the fixture goes straight in.
  const [checkout] = await db.insert(schema.checkout).values({ currency: "MNT" }).returning();
  if (!checkout) throw new Error("no checkout");
  checkoutId = checkout.id;
  fake = createFakeGateway();
  gateways = createGatewayRegistry([dummyGateway, fake]);
});

afterAll(async () => {
  await closeDb();
});

type InitOverrides = Partial<Omit<ChargeRequestInput, "gateway">> & {
  gateway?: PaymentGateway;
  gatewayData?: unknown;
};

/** transactionInitialize's three phases, as checkout/payments.ts runs them. */
async function initialize(overrides: InitOverrides = {}) {
  const gateway = overrides.gateway ?? dummyGateway;
  const recorded = await db.transaction((tx) =>
    recordInitializeRequest(tx, {
      checkoutId,
      currency: "MNT",
      amount: 5000,
      action: "CHARGE",
      idempotencyKey: crypto.randomUUID(),
      ...overrides,
      gateway,
    }),
  );
  if (!recorded.ok) return recorded;
  if (recorded.outcome) return initializeReplay(recorded.transaction, recorded.outcome);
  return processInitializeRequest(db, gateway, recorded.transaction, recorded.request, {
    gatewayData: overrides.gatewayData ?? null,
    returnUrl: null,
  });
}

async function mustInitialize(overrides: InitOverrides = {}) {
  const result = await initialize(overrides);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

const types = async (transactionId: string) =>
  (await getEventsByTransactionIds(db, [transactionId])).map((event) => event.type);

const reload = async (id: string): Promise<PaymentTransactionRow> => {
  const row = await getTransaction(db, id);
  if (!row) throw new Error(`no transaction ${id}`);
  return row;
};

describe("transactionInitialize with the dummy gateway", () => {
  it("charges by default: a request, then CHARGE_SUCCESS", async () => {
    const { transaction, event, data } = await mustInitialize();
    expect(transaction).toMatchObject({
      checkoutId,
      provider: dummyGateway.id,
      chargedAmount: 5000,
      chargePendingAmount: 0,
      authorizedAmount: 0,
      currency: "MNT",
    });
    expect(transaction.pspReference).toMatch(/^dummy-/);
    expect(event).toMatchObject({ type: "CHARGE_SUCCESS", amount: 5000 });
    expect(data).toBeNull();
    expect(await types(transaction.id)).toEqual(["CHARGE_REQUEST", "CHARGE_SUCCESS"]);
  });

  it("authorizes, and records a failure without moving money", async () => {
    const authorized = await mustInitialize({ action: "AUTHORIZATION" });
    expect(authorized.transaction).toMatchObject({
      authorizedAmount: 5000,
      chargePendingAmount: 0,
    });
    expect(await types(authorized.transaction.id)).toEqual([
      "AUTHORIZATION_REQUEST",
      "AUTHORIZATION_SUCCESS",
    ]);

    const failed = await mustInitialize({ gatewayData: { event: { type: "CHARGE_FAILURE" } } });
    expect(failed.transaction).toMatchObject({
      chargedAmount: 0,
      authorizedAmount: 0,
      chargePendingAmount: 0,
    });
    expect(failed.event).toMatchObject({ type: "CHARGE_FAILURE", amount: 0 });

    expect(coveredAmounts(await getTransactionsByCheckoutIds(db, [checkoutId]), "MNT")).toEqual({
      authorized: { amountMinor: 5000, currency: "MNT" },
      charged: { amountMinor: 0, currency: "MNT" },
    });
  });

  it("validates the dummy app's event type against the action", () => {
    expect(dummyGateway.validate?.("CHARGE", { event: { type: "AUTHORIZATION_SUCCESS" } })).toMatch(
      /must be one of/,
    );
    expect(dummyGateway.validate?.("CHARGE", { event: { type: "CHARGE_FAILURE" } })).toBeNull();
    expect(dummyGateway.validate?.("CHARGE", null)).toBeNull();
  });

  it("returns the first result for a retry and UNIQUE for a different request with the key", async () => {
    const first = await mustInitialize({ idempotencyKey: "key-1" });
    const retry = await mustInitialize({ idempotencyKey: "key-1" });
    expect(retry.transaction.id).toBe(first.transaction.id);
    expect(retry.event.id).toBe(first.event.id);

    expect(await initialize({ idempotencyKey: "key-1", amount: 1 })).toMatchObject({
      ok: false,
      errors: [{ field: "idempotencyKey", code: "UNIQUE" }],
    });
    expect(await getTransactionsByCheckoutIds(db, [checkoutId])).toHaveLength(1);
  });
});

describe("transactionInitialize with a redirect gateway", () => {
  it("waits for the shopper: CHARGE_ACTION_REQUIRED with the page, the amount pending", async () => {
    const { transaction, event, data } = await mustInitialize({ gateway: fake });
    expect(event).toMatchObject({ type: "CHARGE_ACTION_REQUIRED", amount: 5000 });
    expect(event.externalUrl).toBe(`https://pay.example.test/${transaction.id}`);
    expect(data).toEqual({ url: event.externalUrl });
    expect(transaction).toMatchObject({
      chargedAmount: 0,
      chargePendingAmount: 5000,
      externalUrl: event.externalUrl,
    });
    expect(transaction.pspReference).toMatch(/^pi_/);
    // The gateway got our transaction id as its idempotency key.
    expect(fake.calls).toEqual([
      { method: "initialize", input: expect.objectContaining({ transactionId: transaction.id }) },
    ]);
  });

  it("returns the same page to a retry without calling the gateway again", async () => {
    const first = await mustInitialize({ gateway: fake, idempotencyKey: "attempt-1" });
    const retry = await mustInitialize({ gateway: fake, idempotencyKey: "attempt-1" });
    expect(retry.transaction.id).toBe(first.transaction.id);
    expect(retry.data).toEqual(first.data);
    expect(fake.calls.filter((call) => call.method === "initialize")).toHaveLength(1);
  });

  it("finishes a request whose answer was never recorded (a crash between the phases)", async () => {
    const recorded = await db.transaction((tx) =>
      recordInitializeRequest(tx, {
        checkoutId,
        currency: "MNT",
        amount: 5000,
        action: "CHARGE",
        gateway: fake,
        idempotencyKey: "attempt-1",
      }),
    );
    if (!recorded.ok) throw new Error("not recorded");
    // The process "died" here: the request is recorded, the gateway never answered us.
    const retry = await mustInitialize({ gateway: fake, idempotencyKey: "attempt-1" });
    expect(retry.transaction.id).toBe(recorded.transaction.id);
    expect(retry.event.type).toBe("CHARGE_ACTION_REQUIRED");
    expect(await types(retry.transaction.id)).toEqual(["CHARGE_REQUEST", "CHARGE_ACTION_REQUIRED"]);
  });

  it("records an unreachable gateway as a failure the shopper can retry", async () => {
    fake.failNext("initialize");
    const { transaction, event, data } = await mustInitialize({ gateway: fake });
    expect(event).toMatchObject({ type: "CHARGE_FAILURE", amount: 0 });
    expect(event.message).toMatch(/not available/);
    expect(data).toBeNull();
    expect(transaction.chargePendingAmount).toBe(0);
  });
});

describe("applyGatewayStatus", () => {
  async function waiting() {
    const { transaction } = await mustInitialize({ gateway: fake });
    return transaction;
  }

  it("records a payment once, however often it is applied", async () => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status: "succeeded", chargeReference: "ch_1" });

    const first = await applyGatewayStatus(db, gateways, transaction.id);
    const again = await applyGatewayStatus(db, gateways, transaction.id);
    const concurrent = await Promise.all([
      applyGatewayStatus(db, gateways, transaction.id),
      applyGatewayStatus(db, gateways, transaction.id),
    ]);
    expect(first.changed).toBe(true);
    expect([again, ...concurrent].map((result) => result.changed)).toEqual([false, false, false]);
    expect(await reload(transaction.id)).toMatchObject({
      chargedAmount: 5000,
      chargePendingAmount: 0,
      chargePspReference: "ch_1",
    });
    expect(await types(transaction.id)).toEqual([
      "CHARGE_REQUEST",
      "CHARGE_ACTION_REQUIRED",
      "CHARGE_SUCCESS",
    ]);
  });

  it("changes nothing while the shopper hasn't paid, and records pending once", async () => {
    const transaction = await waiting();
    expect((await applyGatewayStatus(db, gateways, transaction.id)).changed).toBe(false);
    fake.setStatus(transaction.pspReference, { status: "pending" });
    expect((await applyGatewayStatus(db, gateways, transaction.id)).changed).toBe(true);
    expect((await applyGatewayStatus(db, gateways, transaction.id)).changed).toBe(false);
    expect(await types(transaction.id)).toContain("CHARGE_PENDING");
    expect((await reload(transaction.id)).chargePendingAmount).toBe(5000);
  });

  it.each([
    ["failed", "CHARGE_FAILURE"],
    ["canceled", "CANCEL_SUCCESS"],
  ] as const)("releases the pending amount when the payment %s", async (status, type) => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status, message: "Expired" });
    expect((await applyGatewayStatus(db, gateways, transaction.id)).changed).toBe(true);
    expect((await applyGatewayStatus(db, gateways, transaction.id)).changed).toBe(false);
    const events = await getEventsByTransactionIds(db, [transaction.id]);
    expect(events.at(-1)).toMatchObject({ type, amount: 0, message: "Expired" });
    expect(await reload(transaction.id)).toMatchObject({
      chargedAmount: 0,
      chargePendingAmount: 0,
    });
  });

  it("records what was really paid when it differs from what was asked", async () => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status: "succeeded", amount: 4000 });
    await applyGatewayStatus(db, gateways, transaction.id);
    expect(await reload(transaction.id)).toMatchObject({
      chargedAmount: 4000,
      chargePendingAmount: 0,
    });
  });

  it("still records money paid on an attempt already marked as canceled", async () => {
    const transaction = await waiting();
    fake.setStatus(transaction.pspReference, { status: "canceled" });
    await applyGatewayStatus(db, gateways, transaction.id);
    fake.setStatus(transaction.pspReference, { status: "succeeded" });
    expect((await applyGatewayStatus(db, gateways, transaction.id)).changed).toBe(true);
    expect((await reload(transaction.id)).chargedAmount).toBe(5000);
  });

  it("does nothing for a transaction the gateway never answered", async () => {
    fake.failNext("initialize");
    const { transaction } = await mustInitialize({ gateway: fake });
    expect((await applyGatewayStatus(db, gateways, transaction.id)).changed).toBe(false);
  });
});

describe("cancelOpenAttempts", () => {
  it("cancels the checkout's other unpaid attempts and keeps the current one", async () => {
    const old = await mustInitialize({ gateway: fake, idempotencyKey: "old" });
    const current = await mustInitialize({ gateway: fake, idempotencyKey: "current" });
    await cancelOpenAttempts(db, gateways, checkoutId, "current");
    expect(fake.calls).toContainEqual({ method: "cancel", input: old.transaction.pspReference });
    expect(fake.calls).not.toContainEqual({
      method: "cancel",
      input: current.transaction.pspReference,
    });
    expect((await reload(old.transaction.id)).chargePendingAmount).toBe(0);
    expect(await types(old.transaction.id)).toContain("CANCEL_SUCCESS");
    expect((await reload(current.transaction.id)).chargePendingAmount).toBe(5000);
  });

  it("records an older attempt that turns out paid instead of canceling it", async () => {
    const old = await mustInitialize({ gateway: fake, idempotencyKey: "old" });
    fake.setStatus(old.transaction.pspReference, { status: "succeeded" });
    await cancelOpenAttempts(db, gateways, checkoutId, "new");
    expect((await reload(old.transaction.id)).chargedAmount).toBe(5000);
  });

  it("keeps going when a gateway can't be reached", async () => {
    const old = await mustInitialize({ gateway: fake, idempotencyKey: "old" });
    fake.failNext("cancel");
    await expect(cancelOpenAttempts(db, gateways, checkoutId, "new")).resolves.toBeUndefined();
    expect((await reload(old.transaction.id)).chargePendingAmount).toBe(5000);
  });
});

describe("refunds", () => {
  /** A charged transaction through the fake gateway. */
  async function charged() {
    const { transaction } = await mustInitialize({ gateway: fake });
    fake.setStatus(transaction.pspReference, { status: "succeeded", chargeReference: "ch_9" });
    return (await applyGatewayStatus(db, gateways, transaction.id)).transaction;
  }

  async function refund(transaction: PaymentTransactionRow, amount: number) {
    const { request } = await db.transaction(async (tx) =>
      recordRefundRequest(tx, await reload(transaction.id), amount),
    );
    const result = await processRefundRequest(db, gateways, transaction.id, request.id);
    return { request, ...result };
  }

  it("refunds through the gateway with the charge and our request as idempotency key", async () => {
    const transaction = await charged();
    const { request, status, transaction: after } = await refund(transaction, 2000);
    expect(status).toBe("succeeded");
    expect(after).toMatchObject({ refundedAmount: 2000, refundPendingAmount: 0 });
    expect(fake.calls.at(-1)).toEqual({
      method: "refund",
      input: expect.objectContaining({
        chargeReference: "ch_9",
        amount: 2000,
        idempotencyKey: request.id,
      }),
    });
    const events = await getEventsByTransactionIds(db, [transaction.id]);
    expect(events.at(-1)).toMatchObject({ type: "REFUND_SUCCESS", requestEventId: request.id });
  });

  it("releases the amount when the gateway refuses", async () => {
    const transaction = await charged();
    fake.nextRefund = () => ({ status: "failed", refundReference: "", message: "Too late" });
    const { transaction: after } = await refund(transaction, 2000);
    expect(after).toMatchObject({ refundedAmount: 0, refundPendingAmount: 0 });
    expect((await getEventsByTransactionIds(db, [transaction.id])).at(-1)).toMatchObject({
      type: "REFUND_FAILURE",
      message: "Too late",
    });
  });

  it.each([
    ["pending", ""],
    ["manual_required", "The refund is completed manually by the payment provider."],
  ] as const)("keeps a %s refund reserved until it settles", async (status, message) => {
    const transaction = await charged();
    fake.nextRefund = () => ({ status, refundReference: "re_1", message: "" });
    const { transaction: after } = await refund(transaction, 2000);
    expect(after).toMatchObject({ refundedAmount: 0, refundPendingAmount: 2000 });
    expect(refundableAmount(after)).toBe(3000);
    expect((await getEventsByTransactionIds(db, [transaction.id])).at(-1)).toMatchObject({
      type: "REFUND_PENDING",
      message,
    });
  });

  it("keeps the amount reserved when the gateway is unreachable; a retry refunds it once", async () => {
    const transaction = await charged();
    fake.failNext("refund");
    const { request, status, transaction: after } = await refund(transaction, 2000);
    expect(status).toBe("unavailable");
    expect(after.refundPendingAmount).toBe(2000);

    const retried = await processRefundRequest(db, gateways, transaction.id, request.id);
    const again = await processRefundRequest(db, gateways, transaction.id, request.id);
    expect(retried.status).toBe("succeeded");
    expect(again.transaction).toMatchObject({ refundedAmount: 2000, refundPendingAmount: 0 });
    expect(await types(transaction.id)).toEqual([
      "CHARGE_REQUEST",
      "CHARGE_ACTION_REQUIRED",
      "CHARGE_SUCCESS",
      "REFUND_REQUEST",
      "REFUND_SUCCESS",
    ]);
  });

  it("never lets refunds in flight exceed the charge", async () => {
    const transaction = await charged();
    fake.nextRefund = () => ({ status: "pending", refundReference: "re_1", message: "" });
    await refund(transaction, 4000);
    await expect(refund(transaction, 2000)).rejects.toThrow(/refundable/);
    await expect(
      db
        .update(schema.paymentTransaction)
        .set({ refundPendingAmount: 6000 })
        .where(eq(schema.paymentTransaction.id, transaction.id)),
    ).rejects.toThrow();
  });
});

describe("payment table invariants", () => {
  it("never updates or deletes an event", async () => {
    const { event } = await mustInitialize();
    await expect(
      db.update(schema.paymentEvent).set({ amount: 1 }).where(eq(schema.paymentEvent.id, event.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(schema.paymentEvent).where(eq(schema.paymentEvent.id, event.id)),
    ).rejects.toThrow();
    expect(await getEventsByTransactionIds(db, [event.transactionId])).toHaveLength(2);
  });

  it("rejects negative amounts, refunds above the charge and a missing owner", async () => {
    const { transaction } = await mustInitialize();
    const set = (values: Partial<typeof schema.paymentTransaction.$inferInsert>) =>
      db
        .update(schema.paymentTransaction)
        .set(values)
        .where(eq(schema.paymentTransaction.id, transaction.id));

    await expect(set({ authorizedAmount: -1 })).rejects.toThrow();
    await expect(set({ chargePendingAmount: -1 })).rejects.toThrow();
    await expect(set({ refundedAmount: 5001 })).rejects.toThrow();
    await expect(set({ refundedAmount: 3000, refundPendingAmount: 2001 })).rejects.toThrow();
    await expect(set({ checkoutId: null })).rejects.toThrow();
    await expect(set({ refundedAmount: 5000 })).resolves.toBeDefined();
  });

  it("settles a refund request at most once", async () => {
    const { transaction } = await mustInitialize();
    const { request } = await db.transaction(async (tx) =>
      recordRefundRequest(tx, await reload(transaction.id), 1000),
    );
    const settle = () =>
      db.insert(schema.paymentEvent).values({
        transactionId: transaction.id,
        type: "REFUND_SUCCESS",
        amount: 1000,
        currency: "MNT",
        requestEventId: request.id,
      });
    await settle();
    await expect(settle()).rejects.toThrow();
  });
});
