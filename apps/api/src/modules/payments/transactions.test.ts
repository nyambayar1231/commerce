import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  type CheckoutTransactionInput,
  coveredAmounts,
  createCheckoutTransaction,
  DUMMY_GATEWAY_ID,
  getEventsByTransactionIds,
  getTransactionsByCheckoutIds,
} from "./index.ts";

// The dummy gateway and the payment tables' invariants against the real (test) database (M5.3).
const db = getDb();
let checkoutId: string;

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE checkout CASCADE");
  // A bare checkout row: this module writes only payment tables, so the fixture goes straight in.
  const [checkout] = await db.insert(schema.checkout).values({ currency: "MNT" }).returning();
  if (!checkout) throw new Error("no checkout");
  checkoutId = checkout.id;
});

afterAll(async () => {
  await closeDb();
});

const input = (overrides: Partial<CheckoutTransactionInput> = {}): CheckoutTransactionInput => ({
  checkoutId,
  currency: "MNT",
  amount: 5000,
  action: "CHARGE",
  gatewayId: DUMMY_GATEWAY_ID,
  gatewayData: null,
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});

async function mustCreate(overrides: Partial<CheckoutTransactionInput> = {}) {
  const result = await createCheckoutTransaction(db, input(overrides));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

describe("createCheckoutTransaction (dummy gateway)", () => {
  it("charges by default and records a CHARGE_SUCCESS event", async () => {
    const { transaction, event } = await mustCreate();
    expect(transaction).toMatchObject({
      checkoutId,
      provider: DUMMY_GATEWAY_ID,
      chargedAmount: 5000,
      authorizedAmount: 0,
      currency: "MNT",
    });
    expect(transaction.pspReference).toMatch(/^dummy-/);
    expect(event).toMatchObject({ type: "CHARGE_SUCCESS", amount: 5000 });
  });

  it("authorizes, and records a failure without moving money", async () => {
    const authorized = await mustCreate({ action: "AUTHORIZATION" });
    expect(authorized.transaction.authorizedAmount).toBe(5000);

    const failed = await mustCreate({ gatewayData: { event: { type: "CHARGE_FAILURE" } } });
    expect(failed.transaction).toMatchObject({ chargedAmount: 0, authorizedAmount: 0 });
    expect(failed.event.type).toBe("CHARGE_FAILURE");

    expect(coveredAmounts(await getTransactionsByCheckoutIds(db, [checkoutId]), "MNT")).toEqual({
      authorized: { amountMinor: 5000, currency: "MNT" },
      charged: { amountMinor: 0, currency: "MNT" },
    });
  });

  it("rejects an unknown gateway and an event type of the other action", async () => {
    expect(await createCheckoutTransaction(db, input({ gatewayId: "stripe" }))).toMatchObject({
      ok: false,
      errors: [{ field: "paymentGateway", code: "NOT_FOUND" }],
    });
    expect(
      await createCheckoutTransaction(
        db,
        input({ gatewayData: { event: { type: "AUTHORIZATION_SUCCESS" } } }),
      ),
    ).toMatchObject({ ok: false, errors: [{ field: "paymentGateway", code: "INVALID" }] });
  });

  it("returns the first result for a retry and UNIQUE for a different request with the key", async () => {
    const first = await mustCreate({ idempotencyKey: "key-1" });
    const retry = await mustCreate({ idempotencyKey: "key-1" });
    expect(retry.transaction.id).toBe(first.transaction.id);

    expect(
      await createCheckoutTransaction(db, input({ idempotencyKey: "key-1", amount: 1 })),
    ).toMatchObject({ ok: false, errors: [{ field: "idempotencyKey", code: "UNIQUE" }] });
    expect(await getTransactionsByCheckoutIds(db, [checkoutId])).toHaveLength(1);
  });
});

describe("payment table invariants", () => {
  it("never updates or deletes an event", async () => {
    const { event } = await mustCreate();
    await expect(
      db.update(schema.paymentEvent).set({ amount: 1 }).where(eq(schema.paymentEvent.id, event.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(schema.paymentEvent).where(eq(schema.paymentEvent.id, event.id)),
    ).rejects.toThrow();
    expect(await getEventsByTransactionIds(db, [event.transactionId])).toHaveLength(1);
  });

  it("rejects negative amounts, refunds above the charge and a missing owner", async () => {
    const { transaction } = await mustCreate();
    const set = (values: Partial<typeof schema.paymentTransaction.$inferInsert>) =>
      db
        .update(schema.paymentTransaction)
        .set(values)
        .where(eq(schema.paymentTransaction.id, transaction.id));

    await expect(set({ authorizedAmount: -1 })).rejects.toThrow();
    await expect(set({ refundedAmount: 5001 })).rejects.toThrow();
    await expect(set({ checkoutId: null })).rejects.toThrow();
    await expect(set({ refundedAmount: 5000 })).resolves.toBeDefined();
  });
});
