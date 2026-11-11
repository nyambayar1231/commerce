import { closeDb, getDb, schema } from "@commerce/db";
import { eq, ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createProduct,
  createProductVariant,
  deleteProductVariant,
  ProductNotFoundError,
  type ProductRow,
  type ProductVariantRow,
} from "../catalog/index.ts";
import {
  createProductVariantWithStocks,
  createVariantStocks,
  deleteVariantStocks,
  updateVariantStocks,
  WarehouseNotFoundError,
} from "./index.ts";

// Stock writes against the real (test) database, as Saleor's
// productVariantStocksCreate/Update/Delete and productVariantCreate's `stocks`.
const db = getDb();

beforeEach(async () => {
  // Cascades to product_variant and stock; the migration's warehouse row stays.
  await db.$client.unsafe("TRUNCATE product CASCADE");
  // Drop extras a previous test or failed run left behind.
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));
});

afterAll(async () => {
  await closeDb();
});

async function defaultWarehouseId(): Promise<string> {
  const [row] = await db.select().from(schema.warehouse);
  if (!row) throw new Error("the migration did not seed a warehouse");
  return row.id;
}

async function addWarehouse(name = "Zeta Warehouse", slug = "zeta-warehouse"): Promise<string> {
  const [row] = await db.insert(schema.warehouse).values({ name, slug }).returning();
  if (!row) throw new Error("no warehouse");
  return row.id;
}

async function mustCreateProduct(name = "Boots"): Promise<ProductRow> {
  const result = await createProduct(db, { name });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.product;
}

async function mustCreateVariant(productId: string): Promise<ProductVariantRow> {
  const result = await createProductVariant(db, { productId, price: "1000" });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.variant;
}

/** A product with one variant, for the stock cases. */
async function variantFixture() {
  const product = await mustCreateProduct();
  const variant = await mustCreateVariant(product.id);
  return { product, variant };
}

const stockRows = () =>
  db.select().from(schema.stock).orderBy(schema.stock.warehouseId, schema.stock.id);

describe("createVariantStocks", () => {
  it("inserts the stocks and leaves the product's updated_at alone", async () => {
    const { product, variant } = await variantFixture();
    const first = await defaultWarehouseId();
    const second = await addWarehouse();
    const before = await db
      .select({ updatedAt: schema.product.updatedAt })
      .from(schema.product)
      .where(eq(schema.product.id, product.id));

    const result = await createVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: 5 },
      { warehouseId: second, quantity: 7 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variant.id).toBe(variant.id);

    expect(await stockRows()).toEqual([
      expect.objectContaining({ warehouseId: first, variantId: variant.id, quantity: 5 }),
      expect.objectContaining({ warehouseId: second, variantId: variant.id, quantity: 7 }),
    ]);
    // Saleor doesn't bump the product when only its stock changes.
    expect(
      await db
        .select({ updatedAt: schema.product.updatedAt })
        .from(schema.product)
        .where(eq(schema.product.id, product.id)),
    ).toEqual(before);
  });

  it("reports a duplicated warehouse once, at its last occurrence", async () => {
    const { variant } = await variantFixture();
    const first = await defaultWarehouseId();
    const second = await addWarehouse();

    const result = await createVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: 1 },
      { warehouseId: second, quantity: 1 },
      { warehouseId: first, quantity: 1 },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: "warehouse", code: "UNIQUE", message: "Duplicated warehouse ID.", index: 2 },
      ],
    });
    expect(await stockRows()).toEqual([]);
  });

  it("reports a negative quantity and writes nothing", async () => {
    const { variant } = await variantFixture();
    const first = await defaultWarehouseId();

    const result = await createVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: -1 },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: "quantity", code: "INVALID", message: "Quantity can't be negative.", index: 0 },
      ],
    });
    expect(await stockRows()).toEqual([]);
  });

  it("throws WarehouseNotFoundError for an unknown warehouse", async () => {
    const { variant } = await variantFixture();
    const unknown = crypto.randomUUID();

    await expect(
      createVariantStocks(db, variant.id, [{ warehouseId: unknown, quantity: 1 }]),
    ).rejects.toMatchObject({ ids: [unknown] });
    expect(await stockRows()).toEqual([]);
  });

  it("rejects a warehouse that already has stock, writing none of the list", async () => {
    const { variant } = await variantFixture();
    const first = await defaultWarehouseId();
    const second = await addWarehouse();
    await db
      .insert(schema.stock)
      .values({ warehouseId: first, variantId: variant.id, quantity: 1 });

    const result = await createVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: 5 },
      { warehouseId: second, quantity: 2 },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "warehouse",
          code: "UNIQUE",
          message: "Stock for this warehouse already exists for this product variant.",
          index: 0,
        },
      ],
    });
    expect(await stockRows()).toEqual([
      expect.objectContaining({ warehouseId: first, quantity: 1 }),
    ]);
  });
});

describe("updateVariantStocks", () => {
  it("updates existing rows and inserts the missing ones", async () => {
    const { variant } = await variantFixture();
    const first = await defaultWarehouseId();
    const second = await addWarehouse();
    await db
      .insert(schema.stock)
      .values({ warehouseId: first, variantId: variant.id, quantity: 2 });

    const result = await updateVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: 5 },
      { warehouseId: second, quantity: 7 },
    ]);
    expect(result.ok).toBe(true);
    expect(await stockRows()).toEqual([
      expect.objectContaining({ warehouseId: first, quantity: 5 }),
      expect.objectContaining({ warehouseId: second, quantity: 7 }),
    ]);
  });

  it("rejects a quantity below the allocated quantity, writing nothing", async () => {
    const { variant } = await variantFixture();
    const first = await defaultWarehouseId();
    const second = await addWarehouse();
    await db.insert(schema.stock).values({
      warehouseId: first,
      variantId: variant.id,
      quantity: 5,
      quantityAllocated: 4,
    });

    const result = await updateVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: 3 },
      { warehouseId: second, quantity: 7 },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "quantity",
          code: "INVALID",
          message: "Quantity can't be lower than the allocated quantity (4).",
          index: 0,
        },
      ],
    });
    expect(await stockRows()).toEqual([
      expect.objectContaining({ warehouseId: first, quantity: 5 }),
    ]);
  });

  it("reports duplicated warehouses and negative quantities before writing", async () => {
    const { variant } = await variantFixture();
    const first = await defaultWarehouseId();
    const second = await addWarehouse();

    const duplicated = await updateVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: 1 },
      { warehouseId: second, quantity: 1 },
      { warehouseId: second, quantity: 2 },
    ]);
    expect(duplicated).toEqual({
      ok: false,
      errors: [
        { field: "warehouse", code: "UNIQUE", message: "Duplicated warehouse ID.", index: 2 },
      ],
    });

    const negative = await updateVariantStocks(db, variant.id, [
      { warehouseId: first, quantity: -2 },
    ]);
    expect(negative).toEqual({
      ok: false,
      errors: [
        { field: "quantity", code: "INVALID", message: "Quantity can't be negative.", index: 0 },
      ],
    });
    expect(await stockRows()).toEqual([]);
  });
});

describe("deleteVariantStocks", () => {
  it("deletes the given warehouses and ignores unknown or absent ids", async () => {
    const { variant } = await variantFixture();
    const first = await defaultWarehouseId();
    const second = await addWarehouse();
    await db.insert(schema.stock).values([
      { warehouseId: first, variantId: variant.id, quantity: 2 },
      { warehouseId: second, variantId: variant.id, quantity: 4 },
    ]);

    const result = await deleteVariantStocks(db, variant.id, [second, crypto.randomUUID()]);
    expect(result.variant.id).toBe(variant.id);
    expect(await stockRows()).toEqual([
      expect.objectContaining({ warehouseId: first, quantity: 2 }),
    ]);
  });

  it("throws ProductNotFoundError for an unknown variant", async () => {
    await expect(deleteVariantStocks(db, crypto.randomUUID(), [])).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });
});

describe("createProductVariantWithStocks", () => {
  it("creates the variant and its stocks in one transaction", async () => {
    const product = await mustCreateProduct();
    const first = await defaultWarehouseId();

    const result = await createProductVariantWithStocks(
      db,
      { productId: product.id, price: "1000" },
      [{ warehouseId: first, quantity: 3 }],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variant.productId).toBe(product.id);
    expect(await stockRows()).toEqual([
      expect.objectContaining({ variantId: result.variant.id, quantity: 3 }),
    ]);
  });

  it("is the plain variant create when stocks are empty", async () => {
    const product = await mustCreateProduct();

    const result = await createProductVariantWithStocks(
      db,
      { productId: product.id, price: "1000" },
      [],
    );
    expect(result.ok).toBe(true);
    expect(await stockRows()).toEqual([]);
  });

  it("maps stock errors to the stocks field and leaves no variant", async () => {
    const product = await mustCreateProduct();
    const first = await defaultWarehouseId();

    const duplicated = await createProductVariantWithStocks(
      db,
      { productId: product.id, price: "1000" },
      [
        { warehouseId: first, quantity: 1 },
        { warehouseId: first, quantity: 2 },
      ],
    );
    expect(duplicated).toEqual({
      ok: false,
      errors: [{ field: "stocks", code: "UNIQUE", message: "Duplicated warehouse ID." }],
    });

    const negative = await createProductVariantWithStocks(
      db,
      { productId: product.id, price: "1000" },
      [{ warehouseId: first, quantity: -1 }],
    );
    expect(negative).toEqual({
      ok: false,
      errors: [{ field: "stocks", code: "INVALID", message: "Quantity can't be negative." }],
    });

    expect(await db.select().from(schema.productVariant)).toEqual([]);
    expect(await stockRows()).toEqual([]);
  });

  it("rolls back the variant when a warehouse is unknown", async () => {
    const product = await mustCreateProduct();
    const unknown = crypto.randomUUID();

    await expect(
      createProductVariantWithStocks(db, { productId: product.id, price: "1000" }, [
        { warehouseId: unknown, quantity: 1 },
      ]),
    ).rejects.toBeInstanceOf(WarehouseNotFoundError);
    expect(await db.select().from(schema.productVariant)).toEqual([]);
  });
});

/** Postgres codes in an error's cause chain (Drizzle wraps the driver's error). */
function errorCodes(error: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") codes.push(code);
    current = current.cause;
  }
  return codes;
}

describe("lock order", () => {
  it("does not deadlock when a stock update races a variant delete", async () => {
    const warehouseId = await defaultWarehouseId();

    // Twenty rounds of two independent transactions on the same variant: the update locks
    // product → variant → stock rows, the delete product → variant, so neither can deadlock.
    // Each settled request is a success or the deleted variant's ProductNotFoundError.
    for (let round = 0; round < 20; round += 1) {
      const { variant } = await variantFixture();
      await db.insert(schema.stock).values({ warehouseId, variantId: variant.id, quantity: 1 });

      const [update, remove] = await Promise.allSettled([
        updateVariantStocks(db, variant.id, [{ warehouseId, quantity: round + 10 }]),
        deleteProductVariant(db, variant.id),
      ]);

      expect(remove.status).toBe("fulfilled");
      for (const outcome of [update, remove]) {
        if (outcome.status === "fulfilled") continue;
        expect(outcome.reason).toBeInstanceOf(ProductNotFoundError);
        expect(errorCodes(outcome.reason)).not.toContain("40P01");
      }
    }
  });
});
