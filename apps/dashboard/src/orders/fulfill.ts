// Adapted from saleor-dashboard: src/orders/utils/data.ts (getToFulfillOrderLines,
// getDefaultFulfillWarehouse, getOrderLineAvailableQuantity, getOrderFulfillSubmitItems) and
// OrderFulfillPage's shouldEnableSave (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The Fulfill page's rules as plain functions. Saleor reads each line's allocations to know its
// reserved units; our API has no `OrderLine.allocations`, and with one warehouse a tracked line's
// allocation is exactly its quantity left to fulfil (allocated in full at completion, released as
// it is fulfilled), so that stands in for it.
import type { OrderFulfillDataQuery } from "../graphql/types.generated";

export type FulfillLine = NonNullable<OrderFulfillDataQuery["order"]>["lines"][number];
export type FulfillWarehouse = { id: string; name: string };

/** One line's form row: how many to fulfil, from which warehouse. */
export type FulfillFormLine = {
  lineId: string;
  quantity: number;
  warehouse: FulfillWarehouse | null;
};

export const getToFulfillLines = (lines: readonly FulfillLine[]): FulfillLine[] =>
  lines.filter((line) => line.quantityToFulfill > 0);

/** Saleor's getDefaultFulfillWarehouse: where the variant has stock, else the first warehouse. */
export const getDefaultFulfillWarehouse = (
  line: FulfillLine,
  warehouses: readonly FulfillWarehouse[],
): FulfillWarehouse | null => line.variant?.stocks?.[0]?.warehouse ?? warehouses[0] ?? null;

/**
 * Saleor's getOrderLineAvailableQuantity: free stock in the warehouse plus this line's own
 * reservation there. Null for an untracked or deleted variant, which needs no stock.
 */
export const getAvailableQuantity = (line: FulfillLine, warehouseId: string | undefined) => {
  if (!line.variant?.trackInventory || !warehouseId) return null;
  const stock = line.variant.stocks?.find((row) => row.warehouse.id === warehouseId);
  if (!stock) return 0;
  return stock.quantity - stock.quantityAllocated + line.quantityToFulfill;
};

export const initialFormLines = (
  lines: readonly FulfillLine[],
  warehouses: readonly FulfillWarehouse[],
): FulfillFormLine[] =>
  lines.map((line) => ({
    lineId: line.id,
    quantity: line.quantityToFulfill,
    warehouse: getDefaultFulfillWarehouse(line, warehouses),
  }));

/** Saleor's shouldEnableSave: something to fulfil, nothing over, a warehouse wherever needed. */
export const canSubmitFulfillment = (
  form: readonly FulfillFormLine[],
  lines: readonly FulfillLine[],
): boolean => {
  const byId = new Map(lines.map((line) => [line.id, line]));
  const fulfilling = form.filter((row) => row.quantity > 0);
  return (
    fulfilling.length > 0 &&
    form.every(
      (row) => row.quantity >= 0 && row.quantity <= (byId.get(row.lineId)?.quantityToFulfill ?? 0),
    ) &&
    fulfilling.every((row) => row.warehouse !== null)
  );
};

/** Saleor's getOrderFulfillSubmitItems: the orderFulfill input lines, zero rows left out. */
export const getFulfillSubmitLines = (form: readonly FulfillFormLine[]) =>
  form
    .filter((row) => row.quantity > 0 && row.warehouse)
    .map((row) => ({
      orderLineId: row.lineId,
      stocks: [{ quantity: row.quantity, warehouse: row.warehouse?.id ?? "" }],
    }));
