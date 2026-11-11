import { type Executor, schema } from "@commerce/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
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

/** One order line's quantity leaving one warehouse (orderFulfill). */
export type StockDecrease = {
  orderLineId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
};

/** A decrease the locked stock can't cover: no stock row there, or not enough left. */
export type InsufficientFulfillmentStock = { orderLineId: string; warehouseId: string };

/**
 * Saleor's decrease_stock (saleor/warehouse/management.py) for fulfillment, tracked variants only.
 * Locks the affected stock rows in id order, releases each line's allocation in that warehouse (up
 * to the fulfilled quantity) and lowers `stock.quantity`. Units beyond the line's allocation come
 * from free stock: a decrease may never eat into other orders' allocations, so it fails with the
 * lines and warehouses that can't be covered instead. The caller holds the order's lock (the
 * allocations of its lines change only under it) and runs this inside its transaction.
 */
export async function decreaseStocksForFulfillment(
  db: Executor,
  decreases: readonly StockDecrease[],
): Promise<{ ok: true } | { ok: false; insufficient: InsufficientFulfillmentStock[] }> {
  if (decreases.length === 0) return { ok: true };
  const variantIds = [...new Set(decreases.map((item) => item.variantId))];
  const warehouseIds = [...new Set(decreases.map((item) => item.warehouseId))];
  const stocks = await db
    .select()
    .from(schema.stock)
    .where(
      and(
        inArray(schema.stock.variantId, variantIds),
        inArray(schema.stock.warehouseId, warehouseIds),
      ),
    )
    .orderBy(asc(schema.stock.id))
    .for("update");
  const allocations =
    stocks.length === 0
      ? []
      : await db
          .select()
          .from(schema.allocation)
          .where(
            and(
              inArray(schema.allocation.orderLineId, [
                ...new Set(decreases.map((item) => item.orderLineId)),
              ]),
              inArray(
                schema.allocation.stockId,
                stocks.map((stock) => stock.id),
              ),
            ),
          );

  // Running values per stock row, so several lines from one row are checked together.
  const state = new Map(
    stocks.map((stock) => [
      stock.id,
      { quantity: stock.quantity, allocated: stock.quantityAllocated },
    ]),
  );
  const allocationLeft = new Map(
    allocations.map((row) => [`${row.orderLineId}:${row.stockId}`, row.quantityAllocated]),
  );
  const plan: { stockId: string; allocationKey: string; released: number; quantity: number }[] = [];
  const insufficient: InsufficientFulfillmentStock[] = [];

  for (const item of decreases) {
    const stock = stocks.find(
      (row) => row.variantId === item.variantId && row.warehouseId === item.warehouseId,
    );
    const current = stock ? state.get(stock.id) : undefined;
    if (!stock || !current) {
      insufficient.push({ orderLineId: item.orderLineId, warehouseId: item.warehouseId });
      continue;
    }
    const allocationKey = `${item.orderLineId}:${stock.id}`;
    const released = Math.min(item.quantity, allocationLeft.get(allocationKey) ?? 0);
    const quantity = current.quantity - item.quantity;
    const allocated = current.allocated - released;
    if (quantity < allocated) {
      insufficient.push({ orderLineId: item.orderLineId, warehouseId: item.warehouseId });
      continue;
    }
    state.set(stock.id, { quantity, allocated });
    allocationLeft.set(allocationKey, (allocationLeft.get(allocationKey) ?? 0) - released);
    plan.push({ stockId: stock.id, allocationKey, released, quantity: item.quantity });
  }
  if (insufficient.length > 0) return { ok: false, insufficient };

  for (const item of plan) {
    const [orderLineId = "", stockId = ""] = item.allocationKey.split(":");
    if (item.released > 0) {
      const left = allocationLeft.get(item.allocationKey) ?? 0;
      const where = and(
        eq(schema.allocation.orderLineId, orderLineId),
        eq(schema.allocation.stockId, stockId),
      );
      // `left` is the allocation after every planned item, so writing it is idempotent.
      if (left === 0) await db.delete(schema.allocation).where(where);
      else await db.update(schema.allocation).set({ quantityAllocated: left }).where(where);
    }
    await db
      .update(schema.stock)
      .set({
        quantity: sql`${schema.stock.quantity} - ${item.quantity}`,
        quantityAllocated: sql`${schema.stock.quantityAllocated} - ${item.released}`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.stock.id, item.stockId));
  }
  return { ok: true };
}

/**
 * Saleor's deallocate_stock_for_orders: removes every allocation of the given order lines and
 * lowers the stocks' `quantity_allocated` to match, locking the stock rows in id order first.
 * The caller holds the order's lock and runs this inside its transaction (orderCancel).
 */
export async function deallocateOrderLines(
  db: Executor,
  orderLineIds: readonly string[],
): Promise<void> {
  if (orderLineIds.length === 0) return;
  const allocations = await db
    .select()
    .from(schema.allocation)
    .where(inArray(schema.allocation.orderLineId, [...orderLineIds]));
  if (allocations.length === 0) return;

  const released = new Map<string, number>();
  for (const row of allocations) {
    released.set(row.stockId, (released.get(row.stockId) ?? 0) + row.quantityAllocated);
  }
  await db
    .select({ id: schema.stock.id })
    .from(schema.stock)
    .where(inArray(schema.stock.id, [...released.keys()]))
    .orderBy(asc(schema.stock.id))
    .for("update");
  await db.delete(schema.allocation).where(
    inArray(
      schema.allocation.id,
      allocations.map((row) => row.id),
    ),
  );
  for (const [stockId, quantity] of [...released].sort(([a], [b]) => a.localeCompare(b))) {
    await db
      .update(schema.stock)
      .set({
        quantityAllocated: sql`${schema.stock.quantityAllocated} - ${quantity}`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.stock.id, stockId));
  }
}
