import type { Executor } from "@commerce/db";
import DataLoader from "dataloader";
import {
  getEventsByTransactionIds,
  getTransactionsByCheckoutIds,
  type PaymentEventRow,
  type PaymentTransactionRow,
} from "./transactions.ts";

// Per-request batch loaders for payment fields (ARCHITECTURE.md §4, §5.1 step 5): one query per
// field per request, however many checkouts or transactions a response lists.

export interface PaymentLoaders {
  /** `Checkout.transactions` and the checkout's payment statuses. */
  transactionsByCheckoutId: DataLoader<string, PaymentTransactionRow[]>;
  /** `TransactionItem.events`. */
  eventsByTransactionId: DataLoader<string, PaymentEventRow[]>;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (id === null) continue;
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

/** Loaders live for exactly one request: create them in `createContext`, never globally. */
export function createPaymentLoaders(db: Executor): PaymentLoaders {
  return {
    transactionsByCheckoutId: new DataLoader(async (checkoutIds) => {
      const groups = groupBy(
        await getTransactionsByCheckoutIds(db, checkoutIds),
        (row) => row.checkoutId,
      );
      return checkoutIds.map((id) => groups.get(id) ?? []);
    }),
    eventsByTransactionId: new DataLoader(async (transactionIds) => {
      const groups = groupBy(
        await getEventsByTransactionIds(db, transactionIds),
        (row) => row.transactionId,
      );
      return transactionIds.map((id) => groups.get(id) ?? []);
    }),
  };
}
