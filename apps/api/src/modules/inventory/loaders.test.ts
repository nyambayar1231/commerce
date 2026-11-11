import { closeDb, createDb, getDb, schema } from "@commerce/db";
import { ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createInventoryLoaders } from "./index.ts";

// Inventory's nested fields resolve through per-request DataLoaders (ARCHITECTURE.md §5.1 step 5).
// The test counts the SQL statements postgres.js sends: loading several keys of one field must
// cost one query, not one per key.
const db = getDb();
const counted: string[] = [];
const countingDb = createDb(databaseUrl(), { onQuery: (statement) => counted.push(statement) });

/** postgres.js introspects array types on each new connection; those are driver queries. */
const domainQueries = () =>
  counted.filter((statement) => !statement.includes("pg_catalog.pg_type"));

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see apps/api/vitest.config.ts)");
  return url;
}

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE product CASCADE");
  // Keep the migration's row and drop the extra warehouses these tests and failed runs add.
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));
});

afterAll(async () => {
  await countingDb.$client.end({ timeout: 5 });
  await closeDb();
});

async function defaultWarehouseId(): Promise<string> {
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

describe("createInventoryLoaders", () => {
  it("batches stocks by variant and orders them by warehouse name", async () => {
    const warehouse = await defaultWarehouseId();
    const [zeta] = await db
      .insert(schema.warehouse)
      .values({ name: "Zeta Warehouse", slug: "zeta-warehouse" })
      .returning();
    if (!zeta) throw new Error("no second warehouse");
    const first = await seedVariant();
    const second = await seedVariant();
    await db.insert(schema.stock).values([
      { warehouseId: zeta.id, variantId: first.id, quantity: 1 },
      { warehouseId: warehouse, variantId: first.id, quantity: 2 },
      { warehouseId: warehouse, variantId: second.id, quantity: 3 },
    ]);

    const loaders = createInventoryLoaders(countingDb);
    counted.length = 0;
    const [firstStocks, secondStocks] = await Promise.all([
      loaders.stocksByVariantId.load(first.id),
      loaders.stocksByVariantId.load(second.id),
    ]);

    expect(firstStocks.map((stock) => stock.quantity)).toEqual([2, 1]);
    expect(secondStocks.map((stock) => stock.quantity)).toEqual([3]);
    expect(domainQueries()).toHaveLength(1);
  });

  it("batches warehouse lookups and answers null for a missing id", async () => {
    const warehouse = await defaultWarehouseId();
    const [zeta] = await db
      .insert(schema.warehouse)
      .values({ name: "Zeta Warehouse", slug: "zeta-warehouse" })
      .returning();
    if (!zeta) throw new Error("no second warehouse");

    const loaders = createInventoryLoaders(countingDb);
    counted.length = 0;
    const missing = "00000000-0000-4000-8000-000000009999";
    const [first, second, absent] = await Promise.all([
      loaders.warehouseById.load(warehouse),
      loaders.warehouseById.load(zeta.id),
      loaders.warehouseById.load(missing),
    ]);

    expect(first?.name).toBe("Default Warehouse");
    expect(second?.name).toBe("Zeta Warehouse");
    expect(absent).toBeNull();
    expect(domainQueries()).toHaveLength(1);
  });

  it("coalesces repeated product variant lookups into one catalog read", async () => {
    const variant = await seedVariant();
    const loaders = createInventoryLoaders(countingDb);
    counted.length = 0;
    const [first, second] = await Promise.all([
      loaders.productVariantById.load(variant.id),
      loaders.productVariantById.load(variant.id),
    ]);

    expect(first?.sku).toBe(variant.sku);
    expect(second?.sku).toBe(variant.sku);
    expect(domainQueries()).toHaveLength(1);
  });
});
