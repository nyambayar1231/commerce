import { type CurrencyCode, multiplyMoney } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { asc, eq, inArray } from "drizzle-orm";

// Orders (ARCHITECTURE.md §3 "Orders"): Saleor's Order, OrderLine and OrderEvent as immutable
// snapshots. M5.4 only creates them, from a completed checkout; lifecycle actions (fulfill, cancel,
// mark as paid, refund) and their events arrive with M6.

export type OrderRow = typeof schema.order.$inferSelect;
export type OrderLineRow = typeof schema.orderLine.$inferSelect;
export type OrderEventRow = typeof schema.orderEvent.$inferSelect;

/** One line as the checkout hands it over: everything the order must remember about it. */
export type OrderLineSnapshot = {
  variantId: string;
  productName: string;
  variantName: string;
  productSku: string | null;
  quantity: number;
  unitPriceAmount: number;
};

/** A completed checkout, frozen: names, prices and addresses are copies, never references. */
export type OrderSnapshot = {
  checkoutToken: string;
  userId: string | null;
  userEmail: string;
  billingAddress: unknown;
  shippingAddress: unknown;
  shippingMethodName: string;
  shippingPriceAmount: number;
  subtotalAmount: number;
  totalAmount: number;
  currency: string;
  lines: readonly OrderLineSnapshot[];
};

/**
 * Creates the order, its lines (with their totals) and the PLACED event. Must run inside the
 * caller's transaction (checkout completion, ARCHITECTURE §5.4). The database checks that the
 * totals add up and that `checkout_token` is used once.
 */
export async function createOrderFromCheckout(
  db: Executor,
  snapshot: OrderSnapshot,
): Promise<{ order: OrderRow; lines: OrderLineRow[] }> {
  const [order] = await db
    .insert(schema.order)
    .values({
      status: "UNFULFILLED",
      userId: snapshot.userId,
      userEmail: snapshot.userEmail,
      billingAddress: snapshot.billingAddress,
      shippingAddress: snapshot.shippingAddress,
      shippingMethodName: snapshot.shippingMethodName,
      shippingPriceAmount: snapshot.shippingPriceAmount,
      subtotalAmount: snapshot.subtotalAmount,
      totalAmount: snapshot.totalAmount,
      currency: snapshot.currency,
      checkoutToken: snapshot.checkoutToken,
    })
    .returning();
  if (!order) throw new Error("order insert returned no row");

  const lines =
    snapshot.lines.length === 0
      ? []
      : await db
          .insert(schema.orderLine)
          .values(
            snapshot.lines.map((line) => ({
              orderId: order.id,
              variantId: line.variantId,
              productName: line.productName,
              variantName: line.variantName,
              productSku: line.productSku,
              quantity: line.quantity,
              unitPriceAmount: line.unitPriceAmount,
              totalPriceAmount: multiplyMoney(
                { amountMinor: line.unitPriceAmount, currency: snapshot.currency as CurrencyCode },
                line.quantity,
              ).amountMinor,
              currency: snapshot.currency,
            })),
          )
          .returning();

  await db.insert(schema.orderEvent).values({ orderId: order.id, type: "PLACED" });
  return { order, lines };
}

export async function getOrder(db: Executor, id: string): Promise<OrderRow | null> {
  const [order] = await db.select().from(schema.order).where(eq(schema.order.id, id));
  return order ?? null;
}

/** The lines of the given orders, in creation order. One query for any number of ids. */
export async function getOrderLinesByOrderIds(
  db: Executor,
  orderIds: readonly string[],
): Promise<OrderLineRow[]> {
  if (orderIds.length === 0) return [];
  return db
    .select()
    .from(schema.orderLine)
    .where(inArray(schema.orderLine.orderId, [...orderIds]))
    .orderBy(asc(schema.orderLine.createdAt), asc(schema.orderLine.id));
}

/** The events of the given orders, oldest first. One query for any number of ids. */
export async function getOrderEventsByOrderIds(
  db: Executor,
  orderIds: readonly string[],
): Promise<OrderEventRow[]> {
  if (orderIds.length === 0) return [];
  return db
    .select()
    .from(schema.orderEvent)
    .where(inArray(schema.orderEvent.orderId, [...orderIds]))
    .orderBy(asc(schema.orderEvent.createdAt), asc(schema.orderEvent.id));
}
