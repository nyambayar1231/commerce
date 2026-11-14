import { addMoney, type CurrencyCode, multiplyMoney } from "@commerce/contracts";
import { type Db, type Executor, schema } from "@commerce/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { getProductVariantsByIds } from "../catalog/index.ts";
import {
  deallocateOrderLines,
  decreaseStocksForFulfillment,
  getWarehouse,
} from "../inventory/index.ts";
import {
  createManualOrderTransaction,
  getTransaction,
  lockOrderTransactions,
  netCharged,
  type PaymentTransactionRow,
  refundTransaction,
} from "../payments/index.ts";
import type { OrderLineRow, OrderRow } from "./orders.ts";

// Order lifecycle actions (ARCHITECTURE.md §5.5, PLAN M6 decisions 1, 2, 5, 7, 8): Saleor's
// orderFulfill, orderCancel, orderMarkAsPaid and transactionRequestAction(REFUND)
// (saleor/order/actions.py, saleor/warehouse/management.py). Each runs in one transaction and
// takes its locks in one order — the order (FOR UPDATE) → its transactions → stock rows by id —
// so actions on one order serialize and never deadlock with checkout completion or stock writes.
// Every action appends an order event with the staff user who acted.

export type FulfillmentRow = typeof schema.fulfillment.$inferSelect;
export type FulfillmentLineRow = typeof schema.fulfillmentLine.$inferSelect;

/** Saleor's OrderErrorCode values these actions return. */
export type OrderErrorCode =
  | "NOT_FOUND"
  | "INVALID"
  | "INVALID_QUANTITY"
  | "ZERO_QUANTITY"
  | "DUPLICATED_INPUT_ITEM"
  | "FULFILL_ORDER_LINE"
  | "INSUFFICIENT_STOCK"
  | "CANNOT_CANCEL_ORDER"
  | "TRANSACTION_ERROR"
  | "REQUIRED"
  | "SHIPPING_METHOD_NOT_APPLICABLE";

/** Saleor's OrderError, with primary keys (the GraphQL layer turns them into global IDs). */
export type OrderError = {
  field: string | null;
  code: OrderErrorCode;
  message: string;
  orderLines?: string[];
  warehouse?: string;
  /** Which address an address error belongs to (draft orders). */
  addressType?: "SHIPPING" | "BILLING";
};

const error = (
  field: string | null,
  code: OrderErrorCode,
  message: string,
  extra: Pick<OrderError, "orderLines" | "warehouse"> = {},
): OrderError => ({ field, code, message, ...extra });

const MESSAGES = {
  orderNotFound: "Order does not exist.",
  canceledFulfill: "Can't fulfill a canceled order.",
  draftFulfill: "Can't fulfill a draft order.",
  draftMarkAsPaid: "Can't mark a draft order as paid.",
  duplicatedWarehouse: "Duplicated warehouse ID.",
  duplicatedLine: "Duplicated order line ID.",
  lineNotFound: "Order line does not belong to this order.",
  negativeQuantity: "Quantity can't be negative.",
  remaining: (left: number) => `Only ${left} item${left === 1 ? "" : "s"} remaining to fulfill.`,
  zeroQuantity: "Total quantity must be larger than 0.",
  warehouseNotFound: "Warehouse does not exist.",
  insufficientStock: "Insufficient product stock.",
  cannotCancel: "This order can't be canceled.",
  fullyPaid: "The order is already fully paid.",
} as const;

/** The order, locked `FOR UPDATE` for the rest of the transaction; null when it doesn't exist. */
export async function lockOrder(db: Executor, orderId: string): Promise<OrderRow | null> {
  const [order] = await db
    .select()
    .from(schema.order)
    .where(eq(schema.order.id, orderId))
    .for("update");
  return order ?? null;
}

async function appendEvent(
  db: Executor,
  orderId: string,
  type: (typeof schema.ORDER_EVENT_TYPES)[number],
  userId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(schema.orderEvent).values({ orderId, type, userId, payload });
}

/** Saleor's update_order_status after a fulfillment: FULFILLED once every line is. */
const statusAfterFulfillment = (lines: readonly OrderLineRow[]): OrderRow["status"] =>
  lines.every((line) => line.quantityFulfilled === line.quantity)
    ? "FULFILLED"
    : "PARTIALLY_FULFILLED";

// ── orderFulfill ─────────────────────────────────────────────────────────────────────────────

export type FulfillLineInput = {
  orderLineId: string;
  stocks: { warehouseId: string; quantity: number }[];
};

export type FulfillOrderResult =
  | { ok: true; order: OrderRow; fulfillments: FulfillmentRow[] }
  | { ok: false; errors: OrderError[] };

/** Saleor's OrderFulfill.clean_input checks that need no database, in Saleor's order. */
function validateFulfillInput(lines: readonly FulfillLineInput[]): OrderError[] {
  for (const line of lines) {
    const seen = new Set<string>();
    for (const stock of line.stocks) {
      if (seen.has(stock.warehouseId)) {
        return [
          error("warehouse", "DUPLICATED_INPUT_ITEM", MESSAGES.duplicatedWarehouse, {
            warehouse: stock.warehouseId,
          }),
        ];
      }
      seen.add(stock.warehouseId);
    }
  }
  const lineIds = new Set<string>();
  for (const line of lines) {
    if (lineIds.has(line.orderLineId)) {
      return [
        error("orderLineId", "DUPLICATED_INPUT_ITEM", MESSAGES.duplicatedLine, {
          orderLines: [line.orderLineId],
        }),
      ];
    }
    lineIds.add(line.orderLineId);
  }
  // Ours: Saleor skips entries ≤ 0 when fulfilling but sums them in its checks, so a negative
  // entry could hide an over-fulfillment.
  for (const line of lines) {
    if (line.stocks.some((stock) => stock.quantity < 0)) {
      return [
        error("quantity", "INVALID_QUANTITY", MESSAGES.negativeQuantity, {
          orderLines: [line.orderLineId],
        }),
      ];
    }
  }
  return [];
}

/**
 * Saleor's orderFulfill + create_fulfillments: one fulfillment per warehouse, stock decreased for
 * tracked variants (their allocations released first), `quantity_fulfilled` raised, the status
 * recomputed and a FULFILLMENT_FULFILLED_ITEMS event appended. All or nothing.
 */
export async function fulfillOrder(
  db: Db,
  input: { orderId: string; userId: string | null; lines: FulfillLineInput[] },
): Promise<FulfillOrderResult> {
  const inputErrors = validateFulfillInput(input.lines);
  if (inputErrors.length > 0) return { ok: false, errors: inputErrors };

  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) return { ok: false, errors: [error("order", "NOT_FOUND", MESSAGES.orderNotFound)] };
    if (order.status === "CANCELED") {
      return { ok: false, errors: [error("order", "INVALID", MESSAGES.canceledFulfill)] };
    }
    if (order.status === "DRAFT") {
      return { ok: false, errors: [error("order", "INVALID", MESSAGES.draftFulfill)] };
    }

    const orderLines = await tx
      .select()
      .from(schema.orderLine)
      .where(eq(schema.orderLine.orderId, order.id))
      .orderBy(asc(schema.orderLine.createdAt), asc(schema.orderLine.id));
    const byId = new Map(orderLines.map((line) => [line.id, line]));
    const missing = input.lines.filter((line) => !byId.has(line.orderLineId));
    if (missing.length > 0) {
      return {
        ok: false,
        errors: [
          error("orderLineId", "NOT_FOUND", MESSAGES.lineNotFound, {
            orderLines: missing.map((line) => line.orderLineId),
          }),
        ],
      };
    }

    // Saleor's clean_order_line_quantities, then check_total_quantity_of_items.
    for (const line of input.lines) {
      const row = byId.get(line.orderLineId);
      const left = row ? row.quantity - row.quantityFulfilled : 0;
      const requested = line.stocks.reduce((sum, stock) => sum + stock.quantity, 0);
      if (requested > left) {
        return {
          ok: false,
          errors: [
            error("orderLineId", "FULFILL_ORDER_LINE", MESSAGES.remaining(left), {
              orderLines: [line.orderLineId],
            }),
          ],
        };
      }
    }
    const items = input.lines.flatMap((line) =>
      line.stocks
        .filter((stock) => stock.quantity > 0)
        .map((stock) => ({ ...stock, orderLineId: line.orderLineId })),
    );
    if (items.length === 0) {
      return { ok: false, errors: [error("lines", "ZERO_QUANTITY", MESSAGES.zeroQuantity)] };
    }

    const warehouseIds = [...new Set(items.map((item) => item.warehouseId))];
    for (const warehouseId of warehouseIds) {
      if (!(await getWarehouse(tx, warehouseId))) {
        return {
          ok: false,
          errors: [
            error("warehouse", "NOT_FOUND", MESSAGES.warehouseNotFound, { warehouse: warehouseId }),
          ],
        };
      }
    }

    // Stock moves only for tracked variants (Saleor's track_inventory); a line whose variant is
    // gone, or isn't tracked, is fulfilled without touching stock.
    const variantIds = [
      ...new Set(orderLines.flatMap((line) => (line.variantId ? [line.variantId] : []))),
    ];
    const tracked = new Set(
      (await getProductVariantsByIds(tx, variantIds))
        .filter((variant) => variant.trackInventory)
        .map((variant) => variant.id),
    );
    const decreased = await decreaseStocksForFulfillment(
      tx,
      items.flatMap((item) => {
        const variantId = byId.get(item.orderLineId)?.variantId;
        return variantId && tracked.has(variantId) ? [{ ...item, variantId }] : [];
      }),
    );
    if (!decreased.ok) {
      return {
        ok: false,
        errors: decreased.insufficient.map((item) =>
          error("stocks", "INSUFFICIENT_STOCK", MESSAGES.insufficientStock, {
            orderLines: [item.orderLineId],
            warehouse: item.warehouseId,
          }),
        ),
      };
    }

    const [{ last } = { last: 0 }] = await tx
      .select({ last: sql<number>`coalesce(max(${schema.fulfillment.fulfillmentOrder}), 0)::int` })
      .from(schema.fulfillment)
      .where(eq(schema.fulfillment.orderId, order.id));
    const fulfillments: FulfillmentRow[] = [];
    const fulfillmentLineIds: string[] = [];
    for (const [index, warehouseId] of warehouseIds.entries()) {
      const [fulfillment] = await tx
        .insert(schema.fulfillment)
        .values({
          orderId: order.id,
          fulfillmentOrder: last + index + 1,
          status: "FULFILLED",
          warehouseId,
        })
        .returning();
      if (!fulfillment) throw new Error("fulfillment insert returned no row");
      fulfillments.push(fulfillment);
      const lines = await tx
        .insert(schema.fulfillmentLine)
        .values(
          items
            .filter((item) => item.warehouseId === warehouseId)
            .map((item) => ({
              fulfillmentId: fulfillment.id,
              orderLineId: item.orderLineId,
              quantity: item.quantity,
            })),
        )
        .returning({ id: schema.fulfillmentLine.id });
      fulfillmentLineIds.push(...lines.map((line) => line.id));
    }

    const fulfilledPerLine = new Map<string, number>();
    for (const item of items) {
      fulfilledPerLine.set(
        item.orderLineId,
        (fulfilledPerLine.get(item.orderLineId) ?? 0) + item.quantity,
      );
    }
    for (const [lineId, quantity] of fulfilledPerLine) {
      await tx
        .update(schema.orderLine)
        .set({ quantityFulfilled: sql`${schema.orderLine.quantityFulfilled} + ${quantity}` })
        .where(eq(schema.orderLine.id, lineId));
    }
    const updatedLines = orderLines.map((line) => ({
      ...line,
      quantityFulfilled: line.quantityFulfilled + (fulfilledPerLine.get(line.id) ?? 0),
    }));
    const [updated] = await tx
      .update(schema.order)
      .set({ status: statusAfterFulfillment(updatedLines), updatedAt: sql`now()` })
      .where(eq(schema.order.id, order.id))
      .returning();
    if (!updated) throw new Error(`order ${order.id} disappeared`);
    await appendEvent(tx, order.id, "FULFILLMENT_FULFILLED_ITEMS", input.userId, {
      fulfilledItems: fulfillmentLineIds,
    });
    return { ok: true, order: updated, fulfillments };
  });
}

// ── orderCancel ──────────────────────────────────────────────────────────────────────────────

export type OrderActionResult = { ok: true; order: OrderRow } | { ok: false; errors: OrderError[] };

/**
 * Saleor's orderCancel + cancel_order (PLAN M6 decision 2: only while nothing is fulfilled):
 * releases every allocation, sets CANCELED and appends a CANCELED event. Refunds stay separate.
 */
export async function cancelOrder(
  db: Db,
  input: { orderId: string; userId: string | null },
): Promise<OrderActionResult> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) return { ok: false, errors: [error("order", "NOT_FOUND", MESSAGES.orderNotFound)] };
    const [fulfilled] = await tx
      .select({ id: schema.fulfillment.id })
      .from(schema.fulfillment)
      .where(eq(schema.fulfillment.orderId, order.id))
      .limit(1);
    // Saleor's can_cancel: a draft is deleted instead (draftOrderDelete).
    if (order.status === "CANCELED" || order.status === "DRAFT" || fulfilled) {
      return { ok: false, errors: [error("order", "CANNOT_CANCEL_ORDER", MESSAGES.cannotCancel)] };
    }

    const lines = await tx
      .select({ id: schema.orderLine.id })
      .from(schema.orderLine)
      .where(eq(schema.orderLine.orderId, order.id));
    await deallocateOrderLines(
      tx,
      lines.map((line) => line.id),
    );
    const [updated] = await tx
      .update(schema.order)
      .set({ status: "CANCELED", updatedAt: sql`now()` })
      .where(eq(schema.order.id, order.id))
      .returning();
    if (!updated) throw new Error(`order ${order.id} disappeared`);
    await appendEvent(tx, order.id, "CANCELED", input.userId);
    return { ok: true, order: updated };
  });
}

// ── orderMarkAsPaid ──────────────────────────────────────────────────────────────────────────

/** What the order's transactions haven't charged: total − Σ (charged − refunded), never < 0. */
export function uncoveredAmount(
  order: Pick<OrderRow, "totalAmount" | "currency">,
  transactions: readonly PaymentTransactionRow[],
): number {
  const currency = order.currency as CurrencyCode;
  let charged = { amountMinor: 0, currency };
  for (const transaction of transactions) {
    charged = addMoney(charged, {
      amountMinor: netCharged(transaction),
      currency: transaction.currency as CurrencyCode,
    });
  }
  const left = addMoney({ amountMinor: order.totalAmount, currency }, multiplyMoney(charged, -1));
  return Math.max(left.amountMinor, 0);
}

/**
 * Saleor's mark_order_as_paid_with_transaction, adapted (PLAN M6 decision 5): a manual transaction
 * charged with what is still uncovered, and an ORDER_MARKED_AS_PAID event with the staff's
 * reference. Saleor refuses any order that already has transactions; ours always do (checkout
 * completion requires payment), so an order with nothing uncovered is the error instead.
 */
export async function markOrderAsPaid(
  db: Db,
  input: { orderId: string; userId: string | null; transactionReference: string | null },
): Promise<OrderActionResult> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) return { ok: false, errors: [error("order", "NOT_FOUND", MESSAGES.orderNotFound)] };
    if (order.status === "DRAFT") {
      return { ok: false, errors: [error("order", "INVALID", MESSAGES.draftMarkAsPaid)] };
    }
    const transactions = await lockOrderTransactions(tx, order.id);
    const amount = uncoveredAmount(order, transactions);
    if (amount === 0) {
      return { ok: false, errors: [error("transaction", "TRANSACTION_ERROR", MESSAGES.fullyPaid)] };
    }
    const reference = input.transactionReference ?? "";
    await createManualOrderTransaction(tx, {
      orderId: order.id,
      amount,
      currency: order.currency,
      pspReference: reference,
    });
    const [updated] = await tx
      .update(schema.order)
      .set({ updatedAt: sql`now()` })
      .where(eq(schema.order.id, order.id))
      .returning();
    if (!updated) throw new Error(`order ${order.id} disappeared`);
    await appendEvent(tx, order.id, "ORDER_MARKED_AS_PAID", input.userId, {
      transactionReference: reference || null,
    });
    return { ok: true, order: updated };
  });
}

// ── transactionRequestAction(REFUND) ─────────────────────────────────────────────────────────

/** Saleor's TransactionRequestActionErrorCode values the refund returns. */
export type RefundErrorCode = "NOT_FOUND" | "INVALID";
export type RefundError = { field: string | null; code: RefundErrorCode; message: string };

export type RefundResult =
  | { ok: true; transaction: PaymentTransactionRow }
  | { ok: false; errors: RefundError[] };

/**
 * Saleor's transactionRequestAction(REFUND) for an order's transaction (PLAN M6 decision 1): the
 * amount defaults to, and is capped at, what is charged and not yet refunded (Saleor's min()); the
 * gateway answers REFUND_SUCCESS at once; a TRANSACTION_REFUND_REQUESTED event goes on the order.
 * A checkout's transactions can't be refunded (ours; their checkout isn't locked here).
 */
export async function refundOrderTransaction(
  db: Db,
  input: { transactionId: string; amount: number | null; userId: string | null },
): Promise<RefundResult> {
  const found = await getTransaction(db, input.transactionId);
  if (!found) {
    return {
      ok: false,
      errors: [{ field: "id", code: "NOT_FOUND", message: "Transaction does not exist." }],
    };
  }
  const orderId = found.orderId;
  if (orderId === null) {
    return {
      ok: false,
      errors: [
        { field: "id", code: "INVALID", message: "Only an order's transactions can be refunded." },
      ],
    };
  }
  if (input.amount !== null && input.amount <= 0) {
    return {
      ok: false,
      errors: [{ field: "amount", code: "INVALID", message: "The amount must be positive." }],
    };
  }

  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const transaction = (await lockOrderTransactions(tx, orderId)).find(
      (row) => row.id === found.id,
    );
    if (!order || !transaction) throw new Error(`transaction ${found.id} left its order`);
    const refundable = netCharged(transaction);
    if (refundable <= 0) {
      return {
        ok: false,
        errors: [
          { field: "id", code: "INVALID", message: "The transaction has nothing left to refund." },
        ],
      };
    }
    const amount = Math.min(input.amount ?? refundable, refundable);
    const updated = await refundTransaction(tx, transaction, amount);
    await tx
      .update(schema.order)
      .set({ updatedAt: sql`now()` })
      .where(eq(schema.order.id, order.id));
    await appendEvent(tx, order.id, "TRANSACTION_REFUND_REQUESTED", input.userId, {
      amount,
      currency: transaction.currency,
      transactionReference: transaction.pspReference || null,
    });
    return { ok: true, transaction: updated };
  });
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────

/** The fulfillments of the given orders, by fulfillment order. One query for any number of ids. */
export async function getFulfillmentsByOrderIds(
  db: Executor,
  orderIds: readonly string[],
): Promise<FulfillmentRow[]> {
  if (orderIds.length === 0) return [];
  return db
    .select()
    .from(schema.fulfillment)
    .where(inArray(schema.fulfillment.orderId, [...orderIds]))
    .orderBy(asc(schema.fulfillment.orderId), asc(schema.fulfillment.fulfillmentOrder));
}

/** The lines of the given fulfillments. One query for any number of ids. */
export async function getFulfillmentLinesByFulfillmentIds(
  db: Executor,
  fulfillmentIds: readonly string[],
): Promise<FulfillmentLineRow[]> {
  if (fulfillmentIds.length === 0) return [];
  return db
    .select()
    .from(schema.fulfillmentLine)
    .where(inArray(schema.fulfillmentLine.fulfillmentId, [...fulfillmentIds]))
    .orderBy(asc(schema.fulfillmentLine.id));
}

/** Fulfillment lines by id, in the given order (an event's `fulfilledItems`). */
export async function getFulfillmentLinesByIds(
  db: Executor,
  ids: readonly string[],
): Promise<FulfillmentLineRow[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.fulfillmentLine)
    .where(inArray(schema.fulfillmentLine.id, [...ids]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** An order line by id (a fulfillment line's `orderLine`). */
export async function getOrderLinesByIds(
  db: Executor,
  ids: readonly string[],
): Promise<OrderLineRow[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(schema.orderLine)
    .where(inArray(schema.orderLine.id, [...ids]));
}
