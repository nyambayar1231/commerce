import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  calculateCheckoutTotals,
  createCheckout,
  createShippingMethod,
  deleteShippingMethod,
  getCheckout,
  listActiveShippingMethods,
  listShippingMethods,
  ShippingMethodNotFoundError,
  seedDemoShippingMethods,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
  updateShippingMethod,
} from "./index.ts";

// Shipping methods, checkout addresses and delivery against the real (test) database (M5.2).
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE product, checkout, shipping_method CASCADE");
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

async function mustCreateMethod(name: string, price: string, isActive = true) {
  const result = await createShippingMethod(db, { name, price, isActive });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.shippingMethod;
}

async function emptyCheckout() {
  const result = await createCheckout(db, { lines: [] });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.checkout;
}

/** A checkout with one line of an untracked, published 1000 MNT variant. */
async function checkoutWithLine(quantity: number) {
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
  const result = await createCheckout(db, { lines: [{ variantId: variant.id, quantity }] });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.checkout;
}

describe("shipping methods", () => {
  it("creates, updates, lists and deletes methods in the shop currency", async () => {
    const express = await mustCreateMethod(" Express ", "15000");
    const standard = await mustCreateMethod("Standard", "5000");
    expect(express).toMatchObject({ name: "Express", priceAmount: 15000, currency: "MNT" });

    const updated = await updateShippingMethod(db, express.id, { price: "12000", isActive: false });
    expect(updated).toMatchObject({
      ok: true,
      shippingMethod: { priceAmount: 12000, isActive: false },
    });

    expect((await listShippingMethods(db)).map((method) => method.name)).toEqual([
      "Express",
      "Standard",
    ]);
    expect((await listActiveShippingMethods(db)).map((method) => method.id)).toEqual([standard.id]);

    await deleteShippingMethod(db, standard.id);
    expect(await listActiveShippingMethods(db)).toEqual([]);
  });

  it("rejects a blank name and a missing, negative or malformed price", async () => {
    const missing = await createShippingMethod(db, { name: " " });
    expect(missing).toMatchObject({
      ok: false,
      errors: [
        { field: "name", code: "REQUIRED" },
        { field: "price", code: "REQUIRED" },
      ],
    });
    expect(await createShippingMethod(db, { name: "A", price: "-1" })).toMatchObject({
      ok: false,
      errors: [{ field: "price", code: "INVALID" }],
    });
    expect(await createShippingMethod(db, { name: "A", price: "1.5" })).toMatchObject({
      ok: false,
      errors: [{ field: "price", code: "INVALID" }],
    });
  });

  it("throws for an unknown method on update and delete", async () => {
    const id = crypto.randomUUID();
    await expect(updateShippingMethod(db, id, { name: "x" })).rejects.toThrow(
      ShippingMethodNotFoundError,
    );
    await expect(deleteShippingMethod(db, id)).rejects.toThrow(ShippingMethodNotFoundError);
  });

  it("seeds the demo methods once", async () => {
    expect(await seedDemoShippingMethods(db)).toEqual({ created: 2, skipped: 0 });
    expect(await seedDemoShippingMethods(db)).toEqual({ created: 0, skipped: 2 });
  });
});

describe("checkout addresses", () => {
  it("stores cleaned shipping and billing addresses separately", async () => {
    const checkout = await emptyCheckout();
    await updateCheckoutAddress(db, checkout.id, "SHIPPING", ADDRESS);
    const result = await updateCheckoutAddress(db, checkout.id, "BILLING", {
      ...ADDRESS,
      city: "Darkhan",
    });

    expect(result.ok).toBe(true);
    const stored = await getCheckout(db, checkout.id);
    expect(stored?.shippingAddress).toMatchObject({ city: "Ulaanbaatar", country: "MN" });
    expect(stored?.billingAddress).toMatchObject({ city: "Darkhan" });
  });

  it("returns field errors with the address type and keeps the old address", async () => {
    const checkout = await emptyCheckout();
    await updateCheckoutAddress(db, checkout.id, "SHIPPING", ADDRESS);
    const result = await updateCheckoutAddress(db, checkout.id, "SHIPPING", {
      ...ADDRESS,
      city: "",
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ field: "city", code: "REQUIRED", addressType: "SHIPPING" }],
    });
    expect((await getCheckout(db, checkout.id))?.shippingAddress).toMatchObject({
      city: "Ulaanbaatar",
    });
  });

  it("rejects writes to a completed checkout", async () => {
    const checkout = await emptyCheckout();
    await db
      .update(schema.checkout)
      .set({ completedOrderId: crypto.randomUUID() })
      .where(eq(schema.checkout.id, checkout.id));

    expect(await updateCheckoutAddress(db, checkout.id, "SHIPPING", ADDRESS)).toMatchObject({
      ok: false,
      errors: [{ field: "id", code: "INVALID" }],
    });
  });
});

describe("checkout delivery method and totals", () => {
  it("adds the chosen method's live price to the total", async () => {
    const checkout = await checkoutWithLine(2);
    const standard = await mustCreateMethod("Standard", "5000");

    const chosen = await updateCheckoutDeliveryMethod(db, checkout.id, standard.id);
    expect(chosen).toMatchObject({ ok: true, checkout: { shippingMethodId: standard.id } });

    let totals = await calculateCheckoutTotals(db, checkout.id);
    expect(totals.subtotal.gross.amountMinor).toBe(2000);
    expect(totals.shipping.gross.amountMinor).toBe(5000);
    expect(totals.total.gross.amountMinor).toBe(7000);

    await updateShippingMethod(db, standard.id, { price: "6000" });
    totals = await calculateCheckoutTotals(db, checkout.id);
    expect(totals.total.gross.amountMinor).toBe(8000);
  });

  it("rejects an unknown or inactive method and clears the choice with null", async () => {
    const checkout = await checkoutWithLine(1);
    const inactive = await mustCreateMethod("Old", "1000", false);
    const active = await mustCreateMethod("Standard", "5000");

    for (const id of [inactive.id, crypto.randomUUID()]) {
      expect(await updateCheckoutDeliveryMethod(db, checkout.id, id)).toMatchObject({
        ok: false,
        errors: [{ field: "deliveryMethodId", code: "DELIVERY_METHOD_NOT_APPLICABLE" }],
      });
    }

    await updateCheckoutDeliveryMethod(db, checkout.id, active.id);
    const cleared = await updateCheckoutDeliveryMethod(db, checkout.id, null);
    expect(cleared).toMatchObject({ ok: true, checkout: { shippingMethodId: null } });
  });

  it("stops charging shipping when the chosen method is switched off or deleted", async () => {
    const checkout = await checkoutWithLine(1);
    const standard = await mustCreateMethod("Standard", "5000");
    await updateCheckoutDeliveryMethod(db, checkout.id, standard.id);

    await updateShippingMethod(db, standard.id, { isActive: false });
    expect((await calculateCheckoutTotals(db, checkout.id)).total.gross.amountMinor).toBe(1000);

    await deleteShippingMethod(db, standard.id);
    expect((await getCheckout(db, checkout.id))?.shippingMethodId).toBeNull();
  });
});
