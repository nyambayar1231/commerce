import { type Executor, schema } from "@commerce/db";
import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import { getProductVariant, type ProductVariantRow } from "../catalog/index.ts";
import { getStocksByVariantIds, type StockRow } from "./stocks.ts";
import type { WarehouseRow } from "./warehouses.ts";

// Per-request batch loaders for the inventory's nested fields (ARCHITECTURE.md §4 and §5.1 step 5):
// each loader coalesces the N lookups of one GraphQL field into a single query (or, for catalog
// variants, into the catalog's public read, deduplicated per request).
//
// `ProductVariant.stocks` and `ProductVariant.quantityAvailable` share `stocksByVariantId`, so a
// query that selects both costs one stock query per page, not two.

export interface InventoryLoaders {
  /** `Stock.warehouse`. */
  warehouseById: DataLoader<string, WarehouseRow | null>;
  /** `ProductVariant.stocks` and `ProductVariant.quantityAvailable`. */
  stocksByVariantId: DataLoader<string, StockRow[]>;
  /** `Stock.productVariant`: the catalog's public read, coalesced per request. */
  productVariantById: DataLoader<string, ProductVariantRow | null>;
}

/** Loaders live for exactly one request: create them in `createContext`, never globally. */
export function createInventoryLoaders(db: Executor): InventoryLoaders {
  return {
    warehouseById: new DataLoader(async (ids) => {
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(schema.warehouse)
        .where(inArray(schema.warehouse.id, [...ids]));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? null);
    }),

    stocksByVariantId: new DataLoader(async (variantIds) => {
      const rows = await getStocksByVariantIds(db, variantIds);
      const byVariant = new Map<string, StockRow[]>();
      for (const row of rows) {
        const stocks = byVariant.get(row.variantId);
        if (stocks) stocks.push(row);
        else byVariant.set(row.variantId, [row]);
      }
      return variantIds.map((variantId) => byVariant.get(variantId) ?? []);
    }),

    // The catalog exposes no batched variant read (and this module may not touch its tables), so
    // the batch asks its public function once per id. DataLoader's cache keeps it to one query for
    // the usual case: every stock in the list belongs to the same variant.
    productVariantById: new DataLoader(async (ids) =>
      Promise.all(ids.map((id) => getProductVariant(db, { id }))),
    ),
  };
}
