import { type CurrencyCode, multiplyMoney } from "@commerce/contracts";
import { type Db, type Executor, schema } from "@commerce/db";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { isProductPublished, lockVariantsForKeyShare } from "../catalog/index.ts";
import { lockDraftOrder, saveDraftTotals } from "./drafts.ts";
import type { OrderError } from "./lifecycle.ts";
import type { OrderLineRow, OrderRow } from "./orders.ts";

// A draft's lines (PLAN M13.3): Saleor's orderLinesCreate, orderLineUpdate and orderLineDelete
// (saleor/graphql/order/mutations/order_line*.py) for drafts only. A draft's line prices follow
// the catalog (PLAN M13 decision 2): every change re-reads each line's variant, so names, SKUs and
// prices are current until the draft is completed. Variants are locked FOR KEY SHARE before
// lines are written (ARCHITECTURE §2 rule 6), like checkout completion. Each change appends
// Saleor's ADDED_PRODUCTS or REMOVED_PRODUCTS event with the lines and quantities.

/** Ours: bounds a line so its total stays a safe integer (Saleor has no limit). */
export const MAX_DRAFT_LINE_QUANTITY = 10_000;

export type DraftLineInput = { variantId: string; quantity: number; forceNewLine?: boolean };

export type DraftLinesResult =
  | { ok: true; order: OrderRow; lines: OrderLineRow[] }
  | { ok: false; errors: OrderError[] };

export type DraftLineResult =
  | { ok: true; order: OrderRow; line: OrderLineRow }
  | { ok: false; errors: OrderError[] };

const MESSAGES = {
  notEditable: "Only draft and unconfirmed orders can be edited.",
  lineNotFound: "Order line does not exist.",
  variantNotFound: "Product variant does not exist.",
  notPublished:
    "Can't add product variant that are not published in the channel associated with this draft order.",
  zeroQuantityCreate: "Variants quantity must be greater than 0.",
  zeroQuantityUpdate: "Ensure this value is greater than 0.",
  tooMany: `A line can hold at most ${MAX_DRAFT_LINE_QUANTITY} items.`,
} as const;

const NOT_EDITABLE = { code: "NOT_EDITABLE", message: MESSAGES.notEditable } as const;

/** An event line: Saleor's OrderEventOrderLineObject (line, item name, quantity). */
type EventLine = { lineId: string; itemName: string; quantity: number };

const itemName = (line: Pick<OrderLineRow, "productName" | "variantName">) =>
  line.variantName ? `${line.productName} (${line.variantName})` : line.productName;

async function appendLinesEvent(
  tx: Executor,
  orderId: string,
  type: "ADDED_PRODUCTS" | "REMOVED_PRODUCTS",
  userId: string | null,
  lines: EventLine[],
): Promise<void> {
  if (lines.length === 0) return;
  await tx.insert(schema.orderEvent).values({ orderId, type, userId, payload: { lines } });
}

/**
 * Re-reads every line's variant: current product and variant names, SKU and price (lines whose
 * variant was deleted keep their snapshot), then stores the draft's totals. Runs with the order
 * locked; returns the updated order.
 */
export async function refreshDraftLines(tx: Executor, order: OrderRow): Promise<OrderRow> {
  const lines = await tx
    .select()
    .from(schema.orderLine)
    .where(and(eq(schema.orderLine.orderId, order.id), isNotNull(schema.orderLine.variantId)));
  const variants = new Map(
    (
      await lockVariantsForKeyShare(
        tx,
        lines.map((line) => line.variantId ?? ""),
      )
    ).map((row) => [row.variant.id, row]),
  );
  for (const line of lines) {
    const row = line.variantId ? variants.get(line.variantId) : undefined;
    if (!row) continue;
    const unitPrice = {
      amountMinor: row.variant.priceAmount,
      currency: order.currency as CurrencyCode,
    };
    await tx
      .update(schema.orderLine)
      .set({
        productName: row.product.name,
        variantName: row.variant.name,
        productSku: row.variant.sku,
        unitPriceAmount: unitPrice.amountMinor,
        totalPriceAmount: multiplyMoney(unitPrice, line.quantity).amountMinor,
      })
      .where(eq(schema.orderLine.id, line.id));
  }
  return saveDraftTotals(tx, order.id);
}

/**
 * A new quantity at the line's stored unit price (the database checks total = unit × quantity);
 * refreshDraftLines then re-prices lines whose variant still exists.
 */
async function setLineQuantity(tx: Executor, line: OrderLineRow, quantity: number) {
  const unitPrice = { amountMinor: line.unitPriceAmount, currency: line.currency as CurrencyCode };
  await tx
    .update(schema.orderLine)
    .set({ quantity, totalPriceAmount: multiplyMoney(unitPrice, quantity).amountMinor })
    .where(eq(schema.orderLine.id, line.id));
}

const getLines = (tx: Executor, ids: readonly string[]) =>
  ids.length === 0
    ? Promise.resolve([])
    : tx
        .select()
        .from(schema.orderLine)
        .where(inArray(schema.orderLine.id, [...ids]))
        .orderBy(asc(schema.orderLine.createdAt), asc(schema.orderLine.id));

/**
 * Saleor's orderLinesCreate for a draft: a variant already on exactly one line adds to that line
 * (unless `forceNewLine`); repeated input entries for a variant add up. Only published products.
 */
export async function addDraftOrderLines(
  db: Db,
  input: { orderId: string; userId: string | null; lines: DraftLineInput[] },
): Promise<DraftLinesResult> {
  const zero = input.lines.filter((line) => line.quantity <= 0).map((line) => line.variantId);
  if (zero.length > 0) {
    return {
      ok: false,
      errors: [
        {
          field: "quantity",
          code: "ZERO_QUANTITY",
          message: MESSAGES.zeroQuantityCreate,
          variants: zero,
        },
      ],
    };
  }

  return db.transaction(async (tx) => {
    const locked = await lockDraftOrder(tx, input.orderId, NOT_EDITABLE);
    if (!locked.ok) return locked;

    const variants = new Map(
      (
        await lockVariantsForKeyShare(
          tx,
          input.lines.map((line) => line.variantId),
        )
      ).map((row) => [row.variant.id, row]),
    );
    const missing = input.lines.filter((line) => !variants.has(line.variantId));
    if (missing.length > 0) {
      return {
        ok: false,
        errors: [
          {
            field: "variantId",
            code: "NOT_FOUND",
            message: MESSAGES.variantNotFound,
            variants: [...new Set(missing.map((line) => line.variantId))],
          },
        ],
      };
    }
    const unpublished = [
      ...new Set(
        input.lines
          .filter((line) => {
            const row = variants.get(line.variantId);
            return !row || !isProductPublished(row.product);
          })
          .map((line) => line.variantId),
      ),
    ];
    if (unpublished.length > 0) {
      return {
        ok: false,
        errors: [
          {
            field: "lines",
            code: "PRODUCT_NOT_PUBLISHED",
            message: MESSAGES.notPublished,
            variants: unpublished,
          },
        ],
      };
    }

    // Saleor's validate_lines: group onto the variant's single existing line, or new lines.
    const existing = await tx
      .select()
      .from(schema.orderLine)
      .where(eq(schema.orderLine.orderId, input.orderId));
    const linesOfVariant = (variantId: string) =>
      existing.filter((line) => line.variantId === variantId);
    const additions = new Map<string, number>(); // existing line id → quantity added
    const merged = new Map<string, number>(); // variant id → quantity on a new line
    const separate: DraftLineInput[] = [];
    for (const line of input.lines) {
      const onLines = linesOfVariant(line.variantId);
      if (line.forceNewLine || onLines.length > 1) {
        separate.push(line);
      } else if (onLines[0]) {
        additions.set(onLines[0].id, (additions.get(onLines[0].id) ?? 0) + line.quantity);
      } else {
        merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
      }
    }

    const tooMany =
      [...separate.map((line) => line.quantity), ...merged.values()].some(
        (quantity) => quantity > MAX_DRAFT_LINE_QUANTITY,
      ) ||
      [...additions].some(
        ([lineId, quantity]) =>
          (existing.find((line) => line.id === lineId)?.quantity ?? 0) + quantity >
          MAX_DRAFT_LINE_QUANTITY,
      );
    if (tooMany) {
      return {
        ok: false,
        errors: [{ field: "quantity", code: "INVALID_QUANTITY", message: MESSAGES.tooMany }],
      };
    }

    const touched: string[] = [];
    const events: { lineId: string; quantity: number }[] = [];
    for (const [lineId, quantity] of additions) {
      const line = existing.find((row) => row.id === lineId);
      if (!line) continue;
      await setLineQuantity(tx, line, line.quantity + quantity);
      touched.push(lineId);
      events.push({ lineId, quantity });
    }
    const toInsert = [
      ...separate,
      ...[...merged].map(([variantId, quantity]) => ({ variantId, quantity })),
    ];
    if (toInsert.length > 0) {
      const inserted = await tx
        .insert(schema.orderLine)
        .values(
          toInsert.map((line) => {
            const row = variants.get(line.variantId);
            if (!row) throw new Error(`variant ${line.variantId} vanished under its lock`);
            // Priced by refreshDraftLines below; zero keeps the total check satisfied meanwhile.
            return {
              orderId: input.orderId,
              variantId: row.variant.id,
              productName: row.product.name,
              variantName: row.variant.name,
              productSku: row.variant.sku,
              quantity: line.quantity,
              unitPriceAmount: 0,
              totalPriceAmount: 0,
              currency: locked.order.currency,
            };
          }),
        )
        .returning({ id: schema.orderLine.id, quantity: schema.orderLine.quantity });
      for (const line of inserted) {
        touched.push(line.id);
        events.push({ lineId: line.id, quantity: line.quantity });
      }
    }

    const order = await refreshDraftLines(tx, locked.order);
    const lines = await getLines(tx, touched);
    const names = new Map(lines.map((line) => [line.id, itemName(line)]));
    await appendLinesEvent(
      tx,
      order.id,
      "ADDED_PRODUCTS",
      input.userId,
      events.map((event) => ({ ...event, itemName: names.get(event.lineId) ?? "" })),
    );
    return { ok: true, order, lines };
  });
}

/** The line's draft, locked, and the line read under that lock. */
async function lockLineDraft(
  tx: Executor,
  lineId: string,
): Promise<
  { ok: true; order: OrderRow; line: OrderLineRow } | { ok: false; errors: OrderError[] }
> {
  const notFound = {
    ok: false as const,
    errors: [{ field: "id", code: "NOT_FOUND" as const, message: MESSAGES.lineNotFound }],
  };
  const [found] = await tx
    .select({ orderId: schema.orderLine.orderId })
    .from(schema.orderLine)
    .where(eq(schema.orderLine.id, lineId));
  if (!found) return notFound;
  const locked = await lockDraftOrder(tx, found.orderId, NOT_EDITABLE);
  if (!locked.ok) return locked;
  const [line] = await tx.select().from(schema.orderLine).where(eq(schema.orderLine.id, lineId));
  return line ? { ok: true, order: locked.order, line } : notFound;
}

/** Saleor's orderLineUpdate for a draft: a new quantity (≥ 1) for one line. */
export async function updateDraftOrderLine(
  db: Db,
  input: { lineId: string; userId: string | null; quantity: number },
): Promise<DraftLineResult> {
  if (input.quantity <= 0) {
    return {
      ok: false,
      errors: [{ field: "quantity", code: "ZERO_QUANTITY", message: MESSAGES.zeroQuantityUpdate }],
    };
  }
  if (input.quantity > MAX_DRAFT_LINE_QUANTITY) {
    return {
      ok: false,
      errors: [{ field: "quantity", code: "INVALID_QUANTITY", message: MESSAGES.tooMany }],
    };
  }
  return db.transaction(async (tx) => {
    const locked = await lockLineDraft(tx, input.lineId);
    if (!locked.ok) return locked;
    const { line } = locked;
    const change = input.quantity - line.quantity;
    await setLineQuantity(tx, line, input.quantity);
    const order = await refreshDraftLines(tx, locked.order);
    const [updated] = await getLines(tx, [line.id]);
    if (!updated) throw new Error(`order line ${line.id} disappeared`);
    if (change !== 0) {
      await appendLinesEvent(
        tx,
        order.id,
        change > 0 ? "ADDED_PRODUCTS" : "REMOVED_PRODUCTS",
        input.userId,
        [{ lineId: line.id, itemName: itemName(updated), quantity: Math.abs(change) }],
      );
    }
    return { ok: true, order, line: updated };
  });
}

/** Saleor's orderLineDelete for a draft. Returns the deleted line. */
export async function deleteDraftOrderLine(
  db: Db,
  input: { lineId: string; userId: string | null },
): Promise<DraftLineResult> {
  return db.transaction(async (tx) => {
    const locked = await lockLineDraft(tx, input.lineId);
    if (!locked.ok) return locked;
    const { line } = locked;
    await tx.delete(schema.orderLine).where(eq(schema.orderLine.id, line.id));
    const order = await refreshDraftLines(tx, locked.order);
    await appendLinesEvent(tx, order.id, "REMOVED_PRODUCTS", input.userId, [
      { lineId: line.id, itemName: itemName(line), quantity: line.quantity },
    ]);
    return { ok: true, order, line };
  });
}
