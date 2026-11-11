import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { markCheckoutCompleted } from "../../../test/orders.ts";
import type { PaymentTransactionRow } from "../payments/index.ts";
import { DUMMY_GATEWAY_ID } from "../payments/index.ts";
import {
  checkoutPaymentStatuses,
  createCheckout,
  initializeCheckoutTransaction,
  uncoveredAmount,
} from "./index.ts";

// Paying for a checkout (M5.3): Saleor's status rules (pure) and transactionInitialize against
// the real (test) database.
const db = getDb();

afterAll(async () => {
  await closeDb();
});

const mnt = (amountMinor: number) => ({ amountMinor, currency: "MNT" as const });
const transaction = (authorizedAmount: number, chargedAmount: number) =>
  ({ authorizedAmount, chargedAmount, currency: "MNT" }) as PaymentTransactionRow;

describe("checkoutPaymentStatuses (Saleor's payment_utils rules)", () => {
  it.each([
    [[], "NONE", "NONE", -1000],
    [[transaction(400, 0)], "PARTIAL", "NONE", -1000],
    [[transaction(0, 400)], "PARTIAL", "PARTIAL", -600],
    [[transaction(600, 400)], "FULL", "PARTIAL", -600],
    [[transaction(0, 1000)], "FULL", "FULL", 0],
    [[transaction(0, 700), transaction(0, 700)], "FULL", "OVERCHARGED", 400],
  ] as const)("%j covers a 1000 total as %s / %s", (transactions, authorize, charge, balance) => {
    expect(checkoutPaymentStatuses(mnt(1000), true, transactions)).toEqual({
      authorizeStatus: authorize,
      chargeStatus: charge,
      totalBalance: mnt(balance),
    });
  });

  it("treats a checkout whose lines cost nothing as fully paid", () => {
    expect(checkoutPaymentStatuses(mnt(0), true, [])).toMatchObject({
      authorizeStatus: "FULL",
      chargeStatus: "FULL",
    });
  });

  it("uncoveredAmount subtracts the larger of authorized and charged per transaction", () => {
    expect(uncoveredAmount(mnt(1000), [transaction(300, 100), transaction(0, 200)])).toEqual(
      mnt(500),
    );
    expect(uncoveredAmount(mnt(1000), [transaction(0, 1500)])).toEqual(mnt(0));
  });
});

describe("initializeCheckoutTransaction", () => {
  let checkoutId: string;

  beforeEach(async () => {
    await db.$client.unsafe('TRUNCATE product, checkout, "order" CASCADE');
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
    const created = await createCheckout(db, { lines: [{ variantId: variant.id, quantity: 3 }] });
    if (!created.ok) throw new Error(JSON.stringify(created.errors));
    checkoutId = created.checkout.id;
  });

  const pay = (
    request: { amount?: string; action?: "AUTHORIZATION" | "CHARGE"; idempotencyKey?: string } = {},
  ) => initializeCheckoutTransaction(db, checkoutId, { gatewayId: DUMMY_GATEWAY_ID, ...request });

  it("charges the uncovered amount by default, then refuses a fully covered checkout", async () => {
    const partial = await pay({ amount: "1000" });
    expect(partial).toMatchObject({ ok: true, transaction: { chargedAmount: 1000 } });

    const rest = await pay();
    expect(rest).toMatchObject({ ok: true, transaction: { chargedAmount: 2000 } });

    expect(await pay()).toMatchObject({
      ok: false,
      errors: [{ field: "amount", code: "INVALID" }],
    });
  });

  it("rejects a non-positive or malformed amount and an empty idempotency key", async () => {
    for (const amount of ["0", "-5", "1.5", "abc"]) {
      expect(await pay({ amount })).toMatchObject({
        ok: false,
        errors: [{ field: "amount", code: "INVALID" }],
      });
    }
    expect(await pay({ idempotencyKey: "" })).toMatchObject({
      ok: false,
      errors: [{ field: "idempotencyKey", code: "INVALID" }],
    });
  });

  it("refuses to pay for a completed checkout", async () => {
    await markCheckoutCompleted(db, checkoutId);
    expect(await pay()).toMatchObject({ ok: false, errors: [{ field: "id", code: "INVALID" }] });
  });
});
