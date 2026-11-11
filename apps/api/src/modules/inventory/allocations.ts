import { type Executor, schema } from "@commerce/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { availableQuantity, type StockRow } from "./stocks.ts";

// Allocation at checkout completion (ARCHITECTURE.md §5.4 steps 5 and 7; Saleor's
// saleor/warehouse/management.py `allocate_stocks` and lock_objects.py). The caller locks the
// checkout and the variants first; these functions lock the variants' stock rows in id order (so
// concurrent completions sharing variants can't deadlock), check availability under the lock, and
// allocate. `CHECK (quantity_allocated <= quantity)` is the final safety net against overselling.

export type AllocationRow = typeof schema.allocation.$inferSelect;

/** A variant whose locked stock can't cover the requested quantity. */
export type InsufficientStock = { variantId: string; available: number };

/** Thrown when allocation finds less stock than the caller checked for (a bug, never input). */
export class InsufficientStockError extends Error {
  readonly items: InsufficientStock[];

  constructor(items: InsufficientStock[]) {
    super(`Insufficient stock for variants: ${items.map((item) => item.variantId).join(", ")}`);
    this.name = "InsufficientStockError";
    this.items = items;
  }
}

/** The stock rows of the given variants, locked `FOR UPDATE` in id order. Inside a transaction. */
export async function lockStocksForVariants(
  db: Executor,
  variantIds: readonly string[],
): Promise<StockRow[]> {
  if (variantIds.length === 0) return [];
  return db
    .select()
    .from(schema.stock)
    .where(inArray(schema.stock.variantId, [...new Set(variantIds)]))
    .orderBy(asc(schema.stock.id))
    .for("update");
}

/** Saleor's stock check: each request against the sum of its variant's available quantity. */
export function findInsufficientStock(
  stocks: readonly StockRow[],
  requests: readonly { variantId: string; quantity: number }[],
): InsufficientStock[] {
  const insufficient: InsufficientStock[] = [];
  for (const request of requests) {
    const available = availableQuantity(
      stocks.filter((stock) => stock.variantId === request.variantId),
    );
    if (request.quantity > available)
      insufficient.push({ variantId: request.variantId, available });
  }
  return insufficient;
}

/**
 * Allocates each line from its variant's locked stocks, in stock id order (one warehouse today; the
 * order stands in for Saleor's warehouse sorting). Inserts allocation rows and raises
 * `stock.quantity_allocated`. Throws InsufficientStockError if a line can't be covered.
 */
export async function allocateStocks(
  db: Executor,
  lockedStocks: readonly StockRow[],
  lines: readonly { orderLineId: string; variantId: string; quantity: number }[],
): Promise<AllocationRow[]> {
  const remaining = new Map(
    lockedStocks.map((stock) => [stock.id, Math.max(stock.quantity - stock.quantityAllocated, 0)]),
  );
  const plan: { orderLineId: string; stockId: string; quantity: number }[] = [];
  const insufficient: InsufficientStock[] = [];

  for (const line of lines) {
    let needed = line.quantity;
    for (const stock of lockedStocks) {
      if (needed === 0) break;
      if (stock.variantId !== line.variantId) continue;
      const free = remaining.get(stock.id) ?? 0;
      const take = Math.min(free, needed);
      if (take === 0) continue;
      plan.push({ orderLineId: line.orderLineId, stockId: stock.id, quantity: take });
      remaining.set(stock.id, free - take);
      needed -= take;
    }
    if (needed > 0) {
      insufficient.push({ variantId: line.variantId, available: line.quantity - needed });
    }
  }
  if (insufficient.length > 0) throw new InsufficientStockError(insufficient);
  if (plan.length === 0) return [];

  const allocations = await db
    .insert(schema.allocation)
    .values(
      plan.map((item) => ({
        orderLineId: item.orderLineId,
        stockId: item.stockId,
        quantityAllocated: item.quantity,
      })),
    )
    .returning();
  for (const item of plan) {
    await db
      .update(schema.stock)
      .set({
        quantityAllocated: sql`${schema.stock.quantityAllocated} + ${item.quantity}`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.stock.id, item.stockId));
  }
  return allocations;
}

/** The allocations of the given order lines (M6 reads them to fulfill or cancel). */
export async function getAllocationsByOrderLineIds(
  db: Executor,
  orderLineIds: readonly string[],
): Promise<AllocationRow[]> {
  if (orderLineIds.length === 0) return [];
  return db
    .select()
    .from(schema.allocation)
    .where(inArray(schema.allocation.orderLineId, [...orderLineIds]))
    .orderBy(asc(schema.allocation.id));
}
