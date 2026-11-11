import { type Executor, schema } from "@commerce/db";
import { asc, eq, inArray } from "drizzle-orm";

// Saleor's `Stock` reads (saleor/warehouse/models.py). Stock is keyed by (warehouse, variant);
// `quantity_allocated` is maintained by the allocation code that arrives with order placement
// (M5.4).

export type StockRow = typeof schema.stock.$inferSelect;

/**
 * The stocks of the given variants, ordered by warehouse name then id (the order
 * `ProductVariant.stocks` exposes, as Saleor's). One query for any number of variants.
 */
export async function getStocksByVariantIds(
  db: Executor,
  variantIds: readonly string[],
): Promise<StockRow[]> {
  if (variantIds.length === 0) return [];
  const rows = await db
    .select({ stock: schema.stock })
    .from(schema.stock)
    .innerJoin(schema.warehouse, eq(schema.stock.warehouseId, schema.warehouse.id))
    .where(inArray(schema.stock.variantId, [...variantIds]))
    .orderBy(asc(schema.warehouse.name), asc(schema.stock.id));
  return rows.map((row) => row.stock);
}

/** Saleor's `available_quantity_for_stock`: quantity − allocated, never below zero, summed. */
export function availableQuantity(stocks: readonly StockRow[]): number {
  return stocks.reduce(
    (total, stock) => total + Math.max(stock.quantity - stock.quantityAllocated, 0),
    0,
  );
}
