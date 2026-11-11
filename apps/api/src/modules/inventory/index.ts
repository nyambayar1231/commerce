// Public surface of the `inventory` module (ARCHITECTURE.md §2).

export type { InventoryLoaders } from "./loaders.ts";
export { createInventoryLoaders } from "./loaders.ts";
export type { BulkStockError, StockInput, VariantStocksResult } from "./stockMutations.ts";
export {
  createProductVariantWithStocks,
  createVariantStocks,
  deleteVariantStocks,
  inStockVariantIdsSql,
  updateVariantStocks,
  WarehouseNotFoundError,
} from "./stockMutations.ts";
export type { StockRow } from "./stocks.ts";
export { availableQuantity, getStocksByVariantIds } from "./stocks.ts";
export type { WarehouseListArgs, WarehousePage, WarehouseRow } from "./warehouses.ts";
export { getWarehouse, InvalidCursorError, listWarehouses } from "./warehouses.ts";
