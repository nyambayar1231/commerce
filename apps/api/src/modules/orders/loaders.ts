import type { Executor } from "@commerce/db";
import DataLoader from "dataloader";
import { getUsersByIds, type SessionUser } from "../identity/index.ts";
import {
  getOrderEventsByOrderIds,
  getOrderLinesByOrderIds,
  type OrderEventRow,
  type OrderLineRow,
} from "./orders.ts";

// Per-request batch loaders for order fields (ARCHITECTURE.md §4, §5.1 step 5): a list page of
// orders costs one query per nested field, not one per order.

export interface OrderLoaders {
  /** `Order.lines`. */
  linesByOrderId: DataLoader<string, OrderLineRow[]>;
  /** `Order.events`. */
  eventsByOrderId: DataLoader<string, OrderEventRow[]>;
  /** `OrderEvent.user`: identity's public read, batched. */
  userById: DataLoader<string, SessionUser | null>;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) group.push(row);
    else groups.set(key(row), [row]);
  }
  return groups;
}

/** Loaders live for exactly one request: create them in `createContext`, never globally. */
export function createOrderLoaders(db: Executor): OrderLoaders {
  return {
    linesByOrderId: new DataLoader(async (orderIds) => {
      const groups = groupBy(await getOrderLinesByOrderIds(db, orderIds), (row) => row.orderId);
      return orderIds.map((id) => groups.get(id) ?? []);
    }),
    eventsByOrderId: new DataLoader(async (orderIds) => {
      const groups = groupBy(await getOrderEventsByOrderIds(db, orderIds), (row) => row.orderId);
      return orderIds.map((id) => groups.get(id) ?? []);
    }),
    userById: new DataLoader(async (ids) => {
      const byId = new Map((await getUsersByIds(db, ids)).map((user) => [user.id, user]));
      return ids.map((id) => byId.get(id) ?? null);
    }),
  };
}
