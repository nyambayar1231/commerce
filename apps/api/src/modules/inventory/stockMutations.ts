import { type Executor, schema } from "@commerce/db";
import { and, asc, eq, inArray, type SQL, sql } from "drizzle-orm";
import {
  createProductVariant,
  lockProductVariant,
  type ProductError,
  type ProductVariantCreateInput,
  type ProductVariantResult,
  type ProductVariantRow,
} from "../catalog/index.ts";
import type { StockRow } from "./stocks.ts";

// Stock writes: Saleor's productVariantStocksCreate/Update/Delete and the `stocks` of
// productVariantCreate (saleor/graphql/product/bulk_mutations/product_variant_stocks_*.py).
// Every write locks the variant's product, then the variant, then its stock rows in id order —
// the order the catalog's variant writes use — so stock, variant and product writes can't
// deadlock (ARCHITECTURE.md §3 "Inventory"). Nothing is written when the input has errors.

export type StockInput = { warehouseId: string; quantity: number };

/** Saleor's BulkStockError payload entry (validation of the `stocks` list). */
export type BulkStockError = {
  field: string | null;
  code: "UNIQUE" | "INVALID";
  message: string;
  index: number | null;
};

export type VariantStocksResult =
  | { ok: true; variant: ProductVariantRow }
  | { ok: false; errors: BulkStockError[] };

/** A warehouse id that matches no row; the GraphQL layer maps it to Saleor's payload error. */
export class WarehouseNotFoundError extends Error {
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Warehouse not found: ${ids.join(", ")}`);
    this.name = "WarehouseNotFoundError";
    this.ids = ids;
  }
}

const MESSAGES = {
  duplicatedWarehouse: "Duplicated warehouse ID.",
  negativeQuantity: "Quantity can't be negative.",
  stockExists: "Stock for this warehouse already exists for this product variant.",
} as const;

/**
 * The variant ids that are in stock, for the catalog's `stockAvailability` filter
 * (`quantity - quantity_allocated > 0`, Saleor's available-quantity rule).
 */
export function inStockVariantIdsSql(): SQL {
  return sql`SELECT s.variant_id FROM stock AS s WHERE s.quantity > s.quantity_allocated`;
}

/** Saleor's check_for_duplicates: one error per duplicated warehouse, at its last occurrence. */
function duplicateErrors(stocks: readonly StockInput[]): BulkStockError[] {
  const seen = new Set<string>();
  const lastIndex = new Map<string, number>();
  stocks.forEach((stock, index) => {
    if (seen.has(stock.warehouseId)) lastIndex.set(stock.warehouseId, index);
    else seen.add(stock.warehouseId);
  });
  return [...lastIndex.values()].map((index) => ({
    field: "warehouse",
    code: "UNIQUE",
    message: MESSAGES.duplicatedWarehouse,
    index,
  }));
}

function negativeQuantityErrors(stocks: readonly StockInput[]): BulkStockError[] {
  const errors: BulkStockError[] = [];
  stocks.forEach((stock, index) => {
    if (stock.quantity < 0) {
      errors.push({
        field: "quantity",
        code: "INVALID",
        message: MESSAGES.negativeQuantity,
        index,
      });
    }
  });
  return errors;
}

/** Throws when any given warehouse doesn't exist (Saleor's get_nodes_or_error). */
async function requireWarehouses(db: Executor, stocks: readonly StockInput[]): Promise<void> {
  const ids = [...new Set(stocks.map((stock) => stock.warehouseId))];
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: schema.warehouse.id })
    .from(schema.warehouse)
    .where(inArray(schema.warehouse.id, ids));
  const found = new Set(rows.map((row) => row.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) throw new WarehouseNotFoundError(missing);
}

/** The variant's stock rows, locked for the rest of the transaction in id order. */
async function lockStocks(db: Executor, variantId: string): Promise<StockRow[]> {
  return db
    .select()
    .from(schema.stock)
    .where(eq(schema.stock.variantId, variantId))
    .orderBy(asc(schema.stock.id))
    .for("update");
}

async function insertStocks(
  db: Executor,
  variantId: string,
  stocks: readonly StockInput[],
): Promise<void> {
  if (stocks.length === 0) return;
  await db.insert(schema.stock).values(
    stocks.map((stock) => ({
      warehouseId: stock.warehouseId,
      variantId,
      quantity: stock.quantity,
    })),
  );
}

export async function createVariantStocks(
  db: Executor,
  variantId: string,
  stocks: readonly StockInput[],
): Promise<VariantStocksResult> {
  return db.transaction(async (tx) => {
    const variant = await lockProductVariant(tx, variantId);
    const existing = await lockStocks(tx, variantId);
    const errors = [...duplicateErrors(stocks), ...negativeQuantityErrors(stocks)];
    // Saleor raises the duplicate/quantity errors before it resolves the warehouses.
    if (errors.length > 0) return { ok: false, errors };
    await requireWarehouses(tx, stocks);

    const existingWarehouses = new Set(existing.map((row) => row.warehouseId));
    stocks.forEach((stock, index) => {
      if (existingWarehouses.has(stock.warehouseId)) {
        errors.push({ field: "warehouse", code: "UNIQUE", message: MESSAGES.stockExists, index });
      }
    });

    if (errors.length > 0) return { ok: false, errors };
    await insertStocks(tx, variantId, stocks);
    return { ok: true, variant };
  });
}

export async function updateVariantStocks(
  db: Executor,
  variantId: string,
  stocks: readonly StockInput[],
): Promise<VariantStocksResult> {
  return db.transaction(async (tx) => {
    const variant = await lockProductVariant(tx, variantId);
    const existing = await lockStocks(tx, variantId);
    const errors = [...duplicateErrors(stocks), ...negativeQuantityErrors(stocks)];
    if (errors.length > 0) return { ok: false, errors };
    await requireWarehouses(tx, stocks);

    // Saleor's get_or_create: a known warehouse's row is updated, a new one is inserted.
    const byWarehouse = new Map(existing.map((row) => [row.warehouseId, row]));
    const updates: { id: string; quantity: number }[] = [];
    const inserts: StockInput[] = [];
    stocks.forEach((stock, index) => {
      const row = byWarehouse.get(stock.warehouseId);
      if (!row) {
        inserts.push(stock);
      } else if (stock.quantity < row.quantityAllocated) {
        errors.push({
          field: "quantity",
          code: "INVALID",
          message: `Quantity can't be lower than the allocated quantity (${row.quantityAllocated}).`,
          index,
        });
      } else {
        updates.push({ id: row.id, quantity: stock.quantity });
      }
    });
    if (errors.length > 0) return { ok: false, errors };

    for (const update of updates) {
      await tx
        .update(schema.stock)
        .set({ quantity: update.quantity, updatedAt: sql`now()` })
        .where(eq(schema.stock.id, update.id));
    }
    await insertStocks(tx, variantId, inserts);
    return { ok: true, variant };
  });
}

export async function deleteVariantStocks(
  db: Executor,
  variantId: string,
  warehouseIds: readonly string[],
): Promise<{ variant: ProductVariantRow }> {
  return db.transaction(async (tx) => {
    const variant = await lockProductVariant(tx, variantId);
    await lockStocks(tx, variantId);

    // Unknown or absent warehouses match no row and are ignored, as Saleor's delete_stocks.
    const ids = [...new Set(warehouseIds)];
    if (ids.length > 0) {
      await tx
        .delete(schema.stock)
        .where(and(eq(schema.stock.variantId, variantId), inArray(schema.stock.warehouseId, ids)));
    }
    return { variant };
  });
}

/**
 * `productVariantCreate`'s `stocks`: validates the stocks first, then creates the variant and
 * inserts the stocks in the same transaction. A stock error is reported on the `stocks` field
 * without an index (Saleor's variant-create error) and leaves no variant behind.
 */
export async function createProductVariantWithStocks(
  db: Executor,
  input: ProductVariantCreateInput,
  stocks: readonly StockInput[],
): Promise<ProductVariantResult> {
  return db.transaction(async (tx) => {
    const errors = [...duplicateErrors(stocks), ...negativeQuantityErrors(stocks)];
    if (errors.length > 0) {
      return {
        ok: false,
        errors: errors.map(
          (error): ProductError => ({
            field: "stocks",
            code: error.code,
            message: error.message,
          }),
        ),
      };
    }
    await requireWarehouses(tx, stocks);

    const result = await createProductVariant(tx, input);
    if (!result.ok) return result;
    await insertStocks(tx, result.variant.id, stocks);
    return result;
  });
}
