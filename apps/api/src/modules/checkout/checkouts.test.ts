import { closeDb, getDb, schema } from "@commerce/db";
import { eq, ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { markCheckoutCompleted } from "../../../test/orders.ts";
import { updateProductVariant } from "../catalog/index.ts";
import {
  addCheckoutLines,
  CheckoutNotFoundError,
  calculateCheckoutTotals,
  createCheckout,
  deleteCheckoutLines,
  getCheckoutLines,
  updateCheckoutEmail,
  updateCheckoutLines,
} from "./index.ts";

// Checkout cart operations against the real (test) database: Saleor's checkout mutations without
// the channel/address/payment parts (ARCHITECTURE.md §3 "Checkout", §5.2–5.3).
const db = getDb();

let warehouseId: string;

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", product, checkout, "order", permission_group CASCADE');
  // Keep the migration's row and drop extras a previous test or failed run left behind.
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));

  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  warehouseId = warehouse.id;
});

afterAll(async () => {
  await closeDb();
});

type VariantOptions = {
  price?: number;
  trackInventory?: boolean;
  published?: boolean;
  sku?: string | null;
};

async function seedVariant(options: VariantOptions = {}) {
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({
      name: "Boots",
      slug: `boots-${suffix}`,
      isPublished: options.published ?? true,
    })
    .returning();
  if (!product) throw new Error("no product");

  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product.id,
      sku: options.sku === undefined ? `SKU-${suffix}` : options.sku,
      priceAmount: options.price ?? 1000,
      currency: "MNT",
      // Untracked unless a test checks stock, so cart tests need no stock rows.
      trackInventory: options.trackInventory ?? false,
    })
    .returning();
  if (!variant) throw new Error("no variant");
  return variant;
}

async function seedStock(variantId: string, quantity: number, quantityAllocated = 0) {
  await db.insert(schema.stock).values({ warehouseId, variantId, quantity, quantityAllocated });
}

async function mustCreate(lines: { variantId: string; quantity: number }[], email?: string) {
  const result = await createCheckout(db, { lines, email });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.checkout;
}

async function mustAdd(checkoutId: string, lines: { variantId: string; quantity: number }[]) {
  const result = await addCheckoutLines(db, checkoutId, lines);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.checkout;
}

const errorCodes = (errors: { code: string }[]) => errors.map((error) => error.code);

describe("createCheckout", () => {
  it("creates an empty checkout in the shop currency with a random v4 id", async () => {
    const checkout = await mustCreate([], "  buyer@example.com  ");

    expect(checkout.email).toBe("buyer@example.com");
    expect(checkout.currency).toBe("MNT");
    expect(checkout.completedOrderId).toBeNull();
    // Version nibble 4 (random UUID — the id doubles as the checkout token, PLAN M5 decision 4).
    expect(checkout.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(await getCheckoutLines(db, checkout.id)).toEqual([]);
  });

  it("creates the requested lines", async () => {
    const first = await seedVariant();
    const second = await seedVariant({ price: 500 });
    const checkout = await mustCreate([
      { variantId: first.id, quantity: 2 },
      { variantId: second.id, quantity: 1 },
    ]);

    const lines = await getCheckoutLines(db, checkout.id);
    expect(lines.map((line) => [line.variantId, line.quantity])).toEqual([
      [first.id, 2],
      [second.id, 1],
    ]);
  });

  it("sums duplicated variants in the input into one line", async () => {
    const variant = await seedVariant();
    const checkout = await mustCreate([
      { variantId: variant.id, quantity: 2 },
      { variantId: variant.id, quantity: 3 },
    ]);

    const lines = await getCheckoutLines(db, checkout.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(5);
  });

  it("stores the email as typed (trimmed) and reports a blank or malformed one", async () => {
    const blank = await createCheckout(db, { lines: [], email: "   " });
    expect(blank).toEqual({
      ok: false,
      errors: [
        {
          field: "email",
          code: "REQUIRED",
          message: "This field cannot be blank.",
          variants: null,
          lines: null,
        },
      ],
    });

    const invalid = await createCheckout(db, { lines: [], email: "not-an-email" });
    expect(invalid).toMatchObject({
      ok: false,
      errors: [{ field: "email", code: "INVALID" }],
    });
  });

  it("rejects a non-positive quantity with ZERO_QUANTITY and creates nothing", async () => {
    const variant = await seedVariant();
    const result = await createCheckout(db, {
      lines: [
        { variantId: variant.id, quantity: 0 },
        { variantId: variant.id, quantity: -1 },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "quantity", code: "ZERO_QUANTITY", variants: [variant.id] }],
    });
    expect(await db.select().from(schema.checkout)).toEqual([]);
  });

  it("rejects an unknown variant with its id in `variants`", async () => {
    const missing = crypto.randomUUID();
    const variant = await seedVariant();
    const result = await createCheckout(db, {
      lines: [{ variantId: missing, quantity: 1 }],
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "variantId", code: "NOT_FOUND", variants: [missing] }],
    });
    expect(await getCheckoutLines(db, variant.id)).toEqual([]);
  });

  it("rejects an unpublished product's variant", async () => {
    const variant = await seedVariant({ published: false });
    const result = await createCheckout(db, {
      lines: [{ variantId: variant.id, quantity: 1 }],
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          field: "lines",
          code: "PRODUCT_NOT_PUBLISHED",
          message: "Cannot add lines for unpublished variants.",
          variants: [variant.id],
        },
      ],
    });
  });

  it("rejects a quantity above the per-line limit", async () => {
    const variant = await seedVariant();
    const result = await createCheckout(db, {
      lines: [{ variantId: variant.id, quantity: 51 }],
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "quantity", code: "QUANTITY_GREATER_THAN_LIMIT", variants: [variant.id] }],
    });
  });

  it("checks stock advisorily and reports the remaining quantity", async () => {
    const variant = await seedVariant({ trackInventory: true, sku: "BOOTS-1" });
    await seedStock(variant.id, 3);

    const result = await createCheckout(db, {
      lines: [{ variantId: variant.id, quantity: 4 }],
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          field: "quantity",
          code: "INSUFFICIENT_STOCK",
          message: "Could not add items BOOTS-1. Only 3 remaining in stock.",
          variants: [variant.id],
        },
      ],
    });
  });

  it("ignores stock when the variant doesn't track inventory", async () => {
    const variant = await seedVariant({ trackInventory: false });
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 40 }]);
    expect((await getCheckoutLines(db, checkout.id))[0]?.quantity).toBe(40);
  });

  it("sums available stock across warehouses and subtracts allocations", async () => {
    const [second] = await db
      .insert(schema.warehouse)
      .values({ name: "Zeta Warehouse", slug: "zeta-warehouse" })
      .returning();
    if (!second) throw new Error("no second warehouse");

    const variant = await seedVariant({ trackInventory: true });
    await seedStock(variant.id, 5, 2);
    await db
      .insert(schema.stock)
      .values({ warehouseId: second.id, variantId: variant.id, quantity: 2, quantityAllocated: 1 });

    // 3 + 1 available.
    const tooMany = await createCheckout(db, {
      lines: [{ variantId: variant.id, quantity: 5 }],
    });
    expect(errorCodes(tooMany.ok ? [] : tooMany.errors)).toEqual(["INSUFFICIENT_STOCK"]);

    const fits = await mustCreate([{ variantId: variant.id, quantity: 4 }]);
    expect((await getCheckoutLines(db, fits.id))[0]?.quantity).toBe(4);
  });
});

describe("addCheckoutLines", () => {
  it("adds a new line and increases an existing one", async () => {
    const first = await seedVariant();
    const second = await seedVariant();
    const checkout = await mustCreate([{ variantId: first.id, quantity: 2 }]);

    const updated = await mustAdd(checkout.id, [
      { variantId: first.id, quantity: 3 },
      { variantId: second.id, quantity: 1 },
    ]);

    expect(updated.id).toBe(checkout.id);
    const lines = await getCheckoutLines(db, checkout.id);
    expect(lines.map((line) => [line.variantId, line.quantity])).toEqual([
      [first.id, 5],
      [second.id, 1],
    ]);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(checkout.updatedAt.getTime());
  });

  it("sums duplicates in the input and applies the limit to the resulting quantity", async () => {
    const variant = await seedVariant();
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 45 }]);

    const result = await addCheckoutLines(db, checkout.id, [
      { variantId: variant.id, quantity: 4 },
      { variantId: variant.id, quantity: 2 },
    ]);

    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "quantity", code: "QUANTITY_GREATER_THAN_LIMIT" }],
    });
    expect((await getCheckoutLines(db, checkout.id))[0]?.quantity).toBe(45);
  });

  it("checks stock against the existing quantity", async () => {
    const variant = await seedVariant({ trackInventory: true, sku: "BOOTS-1" });
    await seedStock(variant.id, 5);
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 3 }]);

    const result = await addCheckoutLines(db, checkout.id, [
      { variantId: variant.id, quantity: 3 },
    ]);

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          field: "quantity",
          code: "INSUFFICIENT_STOCK",
          message: "Could not add items BOOTS-1. Only 5 remaining in stock.",
          variants: [variant.id],
        },
      ],
    });
  });

  it("rejects an unknown variant and an unpublished product", async () => {
    const checkout = await mustCreate([]);
    const missing = crypto.randomUUID();
    const unknown = await addCheckoutLines(db, checkout.id, [{ variantId: missing, quantity: 1 }]);
    expect(unknown).toMatchObject({
      ok: false,
      errors: [{ field: "variantId", code: "NOT_FOUND", variants: [missing] }],
    });

    const hidden = await seedVariant({ published: false });
    const unpublished = await addCheckoutLines(db, checkout.id, [
      { variantId: hidden.id, quantity: 1 },
    ]);
    expect(unpublished).toMatchObject({
      ok: false,
      errors: [{ field: "lines", code: "PRODUCT_NOT_PUBLISHED", variants: [hidden.id] }],
    });
  });

  it("rejects writes to a completed checkout", async () => {
    const variant = await seedVariant();
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 1 }]);
    await markCheckoutCompleted(db, checkout.id);

    const result = await addCheckoutLines(db, checkout.id, [
      { variantId: variant.id, quantity: 1 },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "id",
          code: "INVALID",
          message: "The checkout is already completed.",
          variants: null,
          lines: null,
        },
      ],
    });
  });

  it("throws for an unknown checkout", async () => {
    const id = crypto.randomUUID();
    await expect(addCheckoutLines(db, id, [])).rejects.toThrow(CheckoutNotFoundError);
    await expect(addCheckoutLines(db, id, [])).rejects.toMatchObject({ ids: [id] });
  });
});

describe("updateCheckoutLines", () => {
  it("sets a line's quantity and deletes it at zero", async () => {
    const first = await seedVariant();
    const second = await seedVariant();
    const checkout = await mustCreate([
      { variantId: first.id, quantity: 1 },
      { variantId: second.id, quantity: 1 },
    ]);
    const lines = await getCheckoutLines(db, checkout.id);
    const firstLine = lines.find((line) => line.variantId === first.id);
    const secondLine = lines.find((line) => line.variantId === second.id);

    const result = await updateCheckoutLines(db, checkout.id, [
      { lineId: firstLine?.id ?? "", quantity: 4 },
      { lineId: secondLine?.id ?? "", quantity: 0 },
    ]);

    expect(result.ok).toBe(true);
    const updated = await getCheckoutLines(db, checkout.id);
    expect(updated.map((line) => [line.variantId, line.quantity])).toEqual([[first.id, 4]]);
  });

  it("reports an unknown line with its id in `lines`", async () => {
    const checkout = await mustCreate([]);
    const missing = crypto.randomUUID();

    const result = await updateCheckoutLines(db, checkout.id, [{ lineId: missing, quantity: 1 }]);
    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "lineId", code: "NOT_FOUND", lines: [missing] }],
    });
  });

  it("rejects a negative quantity with Saleor's update message", async () => {
    const variant = await seedVariant();
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 1 }]);
    const [line] = await getCheckoutLines(db, checkout.id);

    const result = await updateCheckoutLines(db, checkout.id, [
      { lineId: line?.id ?? "", quantity: -1 },
    ]);
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          field: "quantity",
          code: "ZERO_QUANTITY",
          message: "The quantity should be higher or equal zero.",
        },
      ],
    });
  });

  it("applies the limit and the advisory stock check to the new quantity", async () => {
    const variant = await seedVariant({ trackInventory: true });
    await seedStock(variant.id, 2);
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 1 }]);
    const [line] = await getCheckoutLines(db, checkout.id);

    const overLimit = await updateCheckoutLines(db, checkout.id, [
      { lineId: line?.id ?? "", quantity: 51 },
    ]);
    expect(errorCodes(overLimit.ok ? [] : overLimit.errors)).toEqual([
      "QUANTITY_GREATER_THAN_LIMIT",
    ]);

    const overStock = await updateCheckoutLines(db, checkout.id, [
      { lineId: line?.id ?? "", quantity: 3 },
    ]);
    expect(overStock).toMatchObject({
      ok: false,
      errors: [{ code: "INSUFFICIENT_STOCK", variants: [variant.id] }],
    });
  });

  it("rejects raising a line whose product became unpublished", async () => {
    const variant = await seedVariant();
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 1 }]);
    await db
      .update(schema.product)
      .set({ isPublished: false })
      .where(eq(schema.product.id, variant.productId));
    const [line] = await getCheckoutLines(db, checkout.id);

    const result = await updateCheckoutLines(db, checkout.id, [
      { lineId: line?.id ?? "", quantity: 2 },
    ]);
    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "lines", code: "PRODUCT_NOT_PUBLISHED", variants: [variant.id] }],
    });
  });

  it("rejects writes to a completed checkout", async () => {
    const checkout = await mustCreate([]);
    await markCheckoutCompleted(db, checkout.id);

    const result = await updateCheckoutLines(db, checkout.id, []);
    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "id", code: "INVALID" }],
    });
  });
});

describe("deleteCheckoutLines", () => {
  it("deletes the given lines", async () => {
    const first = await seedVariant();
    const second = await seedVariant();
    const checkout = await mustCreate([
      { variantId: first.id, quantity: 1 },
      { variantId: second.id, quantity: 1 },
    ]);
    const lines = await getCheckoutLines(db, checkout.id);
    const firstLine = lines.find((line) => line.variantId === first.id);

    const result = await deleteCheckoutLines(db, checkout.id, [firstLine?.id ?? ""]);
    expect(result.ok).toBe(true);
    expect((await getCheckoutLines(db, checkout.id)).map((line) => line.variantId)).toEqual([
      second.id,
    ]);
  });

  it("reports unknown ids in `lines`", async () => {
    const checkout = await mustCreate([]);
    const missing = crypto.randomUUID();

    const result = await deleteCheckoutLines(db, checkout.id, [missing]);
    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: "NOT_FOUND", lines: [missing] }],
    });
  });

  it("rejects writes to a completed checkout", async () => {
    const checkout = await mustCreate([]);
    await markCheckoutCompleted(db, checkout.id);

    const result = await deleteCheckoutLines(db, checkout.id, []);
    expect(result).toMatchObject({ ok: false, errors: [{ field: "id", code: "INVALID" }] });
  });
});

describe("updateCheckoutEmail", () => {
  it("trims and stores the email", async () => {
    const checkout = await mustCreate([]);
    const result = await updateCheckoutEmail(db, checkout.id, "  buyer@example.com ");
    expect(result).toMatchObject({ ok: true, checkout: { email: "buyer@example.com" } });
  });

  it("requires a non-blank, valid email", async () => {
    const checkout = await mustCreate([]);
    const blank = await updateCheckoutEmail(db, checkout.id, " ");
    expect(blank).toMatchObject({
      ok: false,
      errors: [{ field: "email", code: "REQUIRED" }],
    });
    const invalid = await updateCheckoutEmail(db, checkout.id, "nope");
    expect(invalid).toMatchObject({
      ok: false,
      errors: [{ field: "email", code: "INVALID" }],
    });
  });

  it("rejects writes to a completed checkout", async () => {
    const checkout = await mustCreate([]);
    await markCheckoutCompleted(db, checkout.id);

    const result = await updateCheckoutEmail(db, checkout.id, "buyer@example.com");
    expect(result).toMatchObject({ ok: false, errors: [{ field: "id", code: "INVALID" }] });
  });
});

describe("calculateCheckoutTotals", () => {
  it("is zero in the checkout currency without lines", async () => {
    const checkout = await mustCreate([]);
    const totals = await calculateCheckoutTotals(db, checkout.id);

    expect(totals.lines).toEqual([]);
    expect(totals.subtotal).toEqual({
      currency: "MNT",
      net: { amountMinor: 0, currency: "MNT" },
      gross: { amountMinor: 0, currency: "MNT" },
      tax: { amountMinor: 0, currency: "MNT" },
    });
    expect(totals.total).toEqual(totals.subtotal);
  });

  it("sums each line at the variant's current price", async () => {
    const first = await seedVariant({ price: 1000 });
    const second = await seedVariant({ price: 500 });
    const checkout = await mustCreate([
      { variantId: first.id, quantity: 2 },
      { variantId: second.id, quantity: 1 },
    ]);

    const totals = await calculateCheckoutTotals(db, checkout.id);
    expect(totals.lines.map((line) => line.totalPrice.amountMinor)).toEqual([2000, 500]);
    expect(totals.subtotal.gross.amountMinor).toBe(2500);
    expect(totals.total.gross.amountMinor).toBe(2500);
    expect(totals.total.net).toEqual(totals.total.gross);
    expect(totals.total.tax.amountMinor).toBe(0);
  });

  it("is computed live: a variant price change is visible without touching the checkout", async () => {
    const variant = await seedVariant({ price: 1000 });
    const checkout = await mustCreate([{ variantId: variant.id, quantity: 2 }]);

    const updated = await updateProductVariant(db, variant.id, { price: "1500" });
    expect(updated.ok).toBe(true);

    const totals = await calculateCheckoutTotals(db, checkout.id);
    expect(totals.subtotal.gross.amountMinor).toBe(3000);
  });

  it("throws for an unknown checkout", async () => {
    await expect(calculateCheckoutTotals(db, crypto.randomUUID())).rejects.toThrow(
      CheckoutNotFoundError,
    );
  });
});
