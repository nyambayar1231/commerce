import { type Executor, schema } from "@commerce/db";
import DataLoader from "dataloader";
import { asc, inArray } from "drizzle-orm";
import { getProductVariantsByIds, type ProductVariantRow } from "../catalog/index.ts";
import type { CheckoutLineRow } from "./checkouts.ts";
import { type CheckoutTotals, calculateCheckoutTotals } from "./totals.ts";

// Per-request batch loaders for the checkout's nested fields (ARCHITECTURE.md §4, §5.1 step 5):
// `Checkout.lines` and `Checkout.quantity` share one lines query, and `CheckoutLine.variant`
// coalesces into a single batched variant read.

export interface CheckoutLoaders {
  /** `Checkout.lines` and `Checkout.quantity`. */
  linesByCheckoutId: DataLoader<string, CheckoutLineRow[]>;
  /** `CheckoutLine.variant`: the catalog's batched variant read. */
  variantById: DataLoader<string, ProductVariantRow | null>;
  /** `Checkout.subtotalPrice` and `Checkout.totalPrice`, computed once per checkout. */
  totalsByCheckoutId: DataLoader<string, CheckoutTotals>;
}

/** Loaders live for exactly one request: create them in `createContext`, never globally. */
export function createCheckoutLoaders(db: Executor): CheckoutLoaders {
  return {
    linesByCheckoutId: new DataLoader(async (checkoutIds) => {
      if (checkoutIds.length === 0) return [];
      const rows = await db
        .select()
        .from(schema.checkoutLine)
        .where(inArray(schema.checkoutLine.checkoutId, [...checkoutIds]))
        .orderBy(asc(schema.checkoutLine.createdAt), asc(schema.checkoutLine.id));

      const byCheckout = new Map<string, CheckoutLineRow[]>();
      for (const row of rows) {
        const lines = byCheckout.get(row.checkoutId);
        if (lines) lines.push(row);
        else byCheckout.set(row.checkoutId, [row]);
      }
      return checkoutIds.map((checkoutId) => byCheckout.get(checkoutId) ?? []);
    }),

    variantById: new DataLoader(async (ids) => {
      const rows = await getProductVariantsByIds(db, ids);
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? null);
    }),

    totalsByCheckoutId: new DataLoader(async (checkoutIds) =>
      Promise.all(checkoutIds.map((checkoutId) => calculateCheckoutTotals(db, checkoutId))),
    ),
  };
}
