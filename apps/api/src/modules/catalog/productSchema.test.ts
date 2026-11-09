import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// The product tables' own rules (migration 0007), on the real (test) database.
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE category, product CASCADE");
});

afterAll(async () => {
  await closeDb();
});

async function insertProduct(values: Partial<typeof schema.product.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: `boots-${crypto.randomUUID()}`, ...values })
    .returning();
  if (!row) throw new Error("no product");
  return row;
}

const variant = (
  productId: string,
  values: Partial<typeof schema.productVariant.$inferInsert> = {},
) =>
  db
    .insert(schema.productVariant)
    .values({ productId, priceAmount: 15000, currency: "MNT", ...values })
    .returning();

describe("product tables", () => {
  it("defaults to unpublished, and stores prices as integer tögrög", async () => {
    const product = await insertProduct();
    expect(product).toMatchObject({ isPublished: false, publishedAt: null, categoryId: null });

    const [row] = await variant(product.id, { priceAmount: 9_007_199_254_740_991 });
    expect(row?.priceAmount).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects a negative price or weight, an empty name, slug or SKU, and a duplicate slug or SKU", async () => {
    const product = await insertProduct({ slug: "boots" });

    await expect(variant(product.id, { priceAmount: -1 })).rejects.toThrow();
    await expect(variant(product.id, { weightGrams: -5 })).rejects.toThrow();
    await expect(variant(product.id, { sku: "" })).rejects.toThrow();
    await expect(insertProduct({ name: "" })).rejects.toThrow();
    await expect(insertProduct({ slug: "" })).rejects.toThrow();
    await expect(insertProduct({ slug: "boots" })).rejects.toThrow();

    await variant(product.id, { sku: "BT-1" });
    await expect(variant(product.id, { sku: "BT-1" })).rejects.toThrow();
    // Several variants without a SKU are fine.
    await variant(product.id);
    await variant(product.id);
  });

  it("keeps products when their category is deleted, and deletes variants with their product", async () => {
    const [category] = await db
      .insert(schema.category)
      .values({ name: "Shoes", slug: "shoes" })
      .returning({ id: schema.category.id });
    if (!category) throw new Error("no category");
    const product = await insertProduct({ categoryId: category.id });
    await variant(product.id);

    await db.delete(schema.category).where(eq(schema.category.id, category.id));
    const [kept] = await db.select().from(schema.product).where(eq(schema.product.id, product.id));
    expect(kept?.categoryId).toBeNull();

    await db.delete(schema.product).where(eq(schema.product.id, product.id));
    expect(await db.select().from(schema.productVariant)).toEqual([]);
  });
});
