import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { availableQuantity } from "./stocks.ts";

// The stock invariants are database CHECKs and foreign keys (ARCHITECTURE.md §3 "Inventory").
// These tests insert invalid rows directly: no API code should be able to, and the database must
// refuse them even if it could.
const db = getDb();

beforeEach(async () => {
  // Cascades to product_variant and stock; the migration's warehouse row stays.
  await db.$client.unsafe("TRUNCATE product CASCADE");
});

afterAll(async () => {
  await closeDb();
});

async function warehouseId(): Promise<string> {
  const [row] = await db.select().from(schema.warehouse);
  if (!row) throw new Error("the migration did not seed a warehouse");
  return row.id;
}

async function seedVariant() {
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Product", slug: `product-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product.id,
      sku: `SKU-${suffix}`,
      priceAmount: 1000,
      currency: "MNT",
    })
    .returning();
  if (!variant) throw new Error("no variant");
  return variant;
}

/** Drizzle wraps the driver error ("Failed query: …"); the constraint name is in its cause chain. */
async function expectConstraint(promise: Promise<unknown>, constraint: RegExp): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).not.toBeNull();
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    messages.push(current.message);
    current = current.cause;
  }
  expect(messages.join("\n")).toMatch(constraint);
}

describe("stock constraints", () => {
  it("accepts a valid row and defaults the quantities to zero", async () => {
    const variant = await seedVariant();
    const [stock] = await db
      .insert(schema.stock)
      .values({ warehouseId: await warehouseId(), variantId: variant.id })
      .returning();
    expect(stock).toMatchObject({ quantity: 0, quantityAllocated: 0 });
  });

  it("rejects quantity < 0", async () => {
    const variant = await seedVariant();
    // Postgres may report either CHECK: a negative quantity also breaks `allocated ≤ quantity`.
    await expectConstraint(
      db.insert(schema.stock).values({
        warehouseId: await warehouseId(),
        variantId: variant.id,
        quantity: -1,
      }),
      /stock_quantity_not_negative|stock_quantity_allocated_not_greater_than_quantity/,
    );
  });

  it("rejects quantity_allocated < 0", async () => {
    const variant = await seedVariant();
    await expectConstraint(
      db.insert(schema.stock).values({
        warehouseId: await warehouseId(),
        variantId: variant.id,
        quantityAllocated: -1,
      }),
      /stock_quantity_allocated_not_negative/,
    );
  });

  it("rejects quantity_allocated > quantity", async () => {
    const variant = await seedVariant();
    await expectConstraint(
      db.insert(schema.stock).values({
        warehouseId: await warehouseId(),
        variantId: variant.id,
        quantity: 2,
        quantityAllocated: 3,
      }),
      /stock_quantity_allocated_not_greater_than_quantity/,
    );
  });

  it("allows one stock row per warehouse and variant, and no second one", async () => {
    const variant = await seedVariant();
    const values = { warehouseId: await warehouseId(), variantId: variant.id };
    await db.insert(schema.stock).values(values);
    await expectConstraint(
      db.insert(schema.stock).values(values),
      /stock_warehouse_id_variant_id_unique/,
    );
  });

  it("deletes a variant's stock with the variant (FK cascade)", async () => {
    const variant = await seedVariant();
    const [stock] = await db
      .insert(schema.stock)
      .values({ warehouseId: await warehouseId(), variantId: variant.id, quantity: 5 })
      .returning();
    if (!stock) throw new Error("no stock");

    await db.delete(schema.productVariant).where(eq(schema.productVariant.id, variant.id));
    expect(await db.select().from(schema.stock).where(eq(schema.stock.id, stock.id))).toEqual([]);
  });
});

describe("availableQuantity", () => {
  it("sums quantity − allocated per stock, as Saleor's available_quantity_for_stock", () => {
    const stock = (quantity: number, quantityAllocated: number, id: string) => ({
      id,
      warehouseId: "w",
      variantId: "v",
      quantity,
      quantityAllocated,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(availableQuantity([])).toBe(0);
    expect(availableQuantity([stock(10, 3, "a"), stock(4, 1, "b"), stock(0, 0, "c")])).toBe(10);
  });
});
