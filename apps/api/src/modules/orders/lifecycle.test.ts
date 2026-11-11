import { closeDb, getDb, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  completeCheckout,
  createCheckout,
  createShippingMethod,
  initializeCheckoutTransaction,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
} from "../checkout/index.ts";
import { updateVariantStocks } from "../inventory/index.ts";
import { DUMMY_GATEWAY_ID, getTransactionsByOrderIds } from "../payments/index.ts";
import {
  cancelOrder,
  fulfillOrder,
  getFulfillmentLinesByFulfillmentIds,
  getOrderEventsByOrderIds,
  getOrderLinesByOrderIds,
  markOrderAsPaid,
  refundOrderTransaction,
} from "./index.ts";

// Order lifecycle actions against the real (test) database, including real parallel transactions
// (ARCHITECTURE §5.5, §6; PLAN M6 decision 8: order → transactions → stocks).
const db = getDb();
let warehouseId: string;
let shippingMethodId: string;
let staffId: string;

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "order", checkout, product, shipping_method, allocation, payment_transaction, fulfillment, "user" CASCADE',
  );
  await db.delete(schema.warehouse).where(sql`${schema.warehouse.name} <> 'Default Warehouse'`);
  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  warehouseId = warehouse.id;
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error(JSON.stringify(method.errors));
  shippingMethodId = method.shippingMethod.id;
  const [staff] = await db
    .insert(schema.user)
    .values({ email: `staff-${crypto.randomUUID()}@example.com`, isStaff: true })
    .returning();
  if (!staff) throw new Error("no staff");
  staffId = staff.id;
});

afterAll(async () => {
  await closeDb();
});

const ADDRESS = {
  firstName: "Bat",
  lastName: "Dorj",
  streetAddress1: "Peace Avenue 1",
  city: "Ulaanbaatar",
  country: "MN",
};

/** A published variant at `price`; tracked with `stock` units when given, untracked otherwise. */
async function seedVariant(price: number, stock?: number) {
  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: `Boots ${suffix.slice(0, 4)}`, slug: `boots-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product.id,
      name: "42",
      sku: `SKU-${suffix}`,
      priceAmount: price,
      currency: "MNT",
      trackInventory: stock !== undefined,
    })
    .returning();
  if (!variant) throw new Error("no variant");
  if (stock !== undefined) {
    await db.insert(schema.stock).values({ warehouseId, variantId: variant.id, quantity: stock });
  }
  return variant;
}

/** A paid checkout completed into an order; returns the order and its lines. */
async function placeOrder(lines: { variantId: string; quantity: number }[]) {
  const created = await createCheckout(db, { lines, email: "buyer@example.com" });
  if (!created.ok) throw new Error(JSON.stringify(created.errors));
  const id = created.checkout.id;
  await updateCheckoutAddress(db, id, "SHIPPING", ADDRESS);
  await updateCheckoutAddress(db, id, "BILLING", ADDRESS);
  await updateCheckoutDeliveryMethod(db, id, shippingMethodId);
  const paid = await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
  if (!paid.ok) throw new Error(JSON.stringify(paid.errors));
  const result = await completeCheckout(db, id);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { order: result.order, lines: await getOrderLinesByOrderIds(db, [result.order.id]) };
}

async function stockOf(variantId: string) {
  const [stock] = await db.select().from(schema.stock).where(eq(schema.stock.variantId, variantId));
  return stock;
}

const allocationsOf = (orderLineId: string) =>
  db.select().from(schema.allocation).where(eq(schema.allocation.orderLineId, orderLineId));

/** `stock.quantity_allocated` = Σ allocations, for every stock row (ARCHITECTURE §3 Inventory). */
async function expectAllocationsConsistent() {
  const rows = await db.execute<{ id: string; allocated: number; summed: number }>(sql`
    SELECT s.id, s.quantity_allocated AS allocated,
      COALESCE((SELECT sum(a.quantity_allocated) FROM allocation a WHERE a.stock_id = s.id), 0)::int AS summed
    FROM stock s`);
  for (const row of rows) expect(row.allocated).toBe(row.summed);
}

const fulfillAll = (orderId: string, lines: { id: string; quantity: number }[], userId = staffId) =>
  fulfillOrder(db, {
    orderId,
    userId,
    lines: lines.map((line) => ({
      orderLineId: line.id,
      stocks: [{ warehouseId, quantity: line.quantity }],
    })),
  });

describe("fulfillOrder", () => {
  it("decreases stock and allocations, fulfills the lines and records the event", async () => {
    const boots = await seedVariant(1000, 5);
    const socks = await seedVariant(250);
    const { order, lines } = await placeOrder([
      { variantId: boots.id, quantity: 2 },
      { variantId: socks.id, quantity: 3 },
    ]);

    const result = await fulfillAll(order.id, lines);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.order.status).toBe("FULFILLED");
    expect(result.fulfillments).toMatchObject([
      { fulfillmentOrder: 1, status: "FULFILLED", warehouseId },
    ]);
    expect(await stockOf(boots.id)).toMatchObject({ quantity: 3, quantityAllocated: 0 });
    expect(await allocationsOf(lines[0]?.id ?? "")).toEqual([]);
    expect(
      (await getOrderLinesByOrderIds(db, [order.id])).map((line) => line.quantityFulfilled),
    ).toEqual([2, 3]);

    const fulfillmentLines = await getFulfillmentLinesByFulfillmentIds(db, [
      result.fulfillments[0]?.id ?? "",
    ]);
    expect(fulfillmentLines.map((line) => line.quantity).sort()).toEqual([2, 3]);
    const events = await getOrderEventsByOrderIds(db, [order.id]);
    expect(events.map((event) => [event.type, event.userId])).toEqual([
      ["PLACED", null],
      ["FULFILLMENT_FULFILLED_ITEMS", staffId],
    ]);
    expect(events[1]?.payload).toEqual({
      fulfilledItems: expect.arrayContaining(fulfillmentLines.map((line) => line.id)),
    });
    await expectAllocationsConsistent();
  });

  it("fulfills in parts: partially fulfilled, then fulfilled with the next fulfillment order", async () => {
    const boots = await seedVariant(1000, 5);
    const { order, lines } = await placeOrder([{ variantId: boots.id, quantity: 3 }]);
    const lineId = lines[0]?.id ?? "";

    const first = await fulfillAll(order.id, [{ id: lineId, quantity: 1 }]);
    expect(first).toMatchObject({ ok: true, order: { status: "PARTIALLY_FULFILLED" } });
    expect(await stockOf(boots.id)).toMatchObject({ quantity: 4, quantityAllocated: 2 });
    expect(await allocationsOf(lineId)).toMatchObject([{ quantityAllocated: 2 }]);

    const second = await fulfillAll(order.id, [{ id: lineId, quantity: 2 }]);
    expect(second).toMatchObject({
      ok: true,
      order: { status: "FULFILLED" },
      fulfillments: [{ fulfillmentOrder: 2 }],
    });
    expect(await stockOf(boots.id)).toMatchObject({ quantity: 2, quantityAllocated: 0 });
    await expectAllocationsConsistent();
  });

  it("refuses invalid requests with Saleor's error codes and changes nothing", async () => {
    const boots = await seedVariant(1000, 5);
    const { order, lines } = await placeOrder([{ variantId: boots.id, quantity: 2 }]);
    const other = await placeOrder([{ variantId: boots.id, quantity: 1 }]);
    const lineId = lines[0]?.id ?? "";
    const [emptyWarehouse] = await db
      .insert(schema.warehouse)
      .values({ name: "Empty", slug: `empty-${crypto.randomUUID()}` })
      .returning();

    const attempt = (stocks: { warehouseId: string; quantity: number }[], id = lineId) =>
      fulfillOrder(db, {
        orderId: order.id,
        userId: staffId,
        lines: [{ orderLineId: id, stocks }],
      });

    expect(await attempt([{ warehouseId, quantity: 3 }])).toMatchObject({
      ok: false,
      errors: [
        {
          code: "FULFILL_ORDER_LINE",
          field: "orderLineId",
          message: "Only 2 items remaining to fulfill.",
        },
      ],
    });
    expect(await attempt([{ warehouseId, quantity: 0 }])).toMatchObject({
      errors: [{ code: "ZERO_QUANTITY", field: "lines" }],
    });
    expect(
      await attempt([
        { warehouseId, quantity: 1 },
        { warehouseId, quantity: 1 },
      ]),
    ).toMatchObject({ errors: [{ code: "DUPLICATED_INPUT_ITEM", field: "warehouse" }] });
    expect(
      await fulfillOrder(db, {
        orderId: order.id,
        userId: staffId,
        lines: [
          { orderLineId: lineId, stocks: [{ warehouseId, quantity: 1 }] },
          { orderLineId: lineId, stocks: [{ warehouseId, quantity: 1 }] },
        ],
      }),
    ).toMatchObject({ errors: [{ code: "DUPLICATED_INPUT_ITEM", field: "orderLineId" }] });
    expect(
      await attempt([
        { warehouseId, quantity: 3 },
        { warehouseId: emptyWarehouse?.id ?? "", quantity: -1 },
      ]),
    ).toMatchObject({ errors: [{ code: "INVALID_QUANTITY" }] });
    expect(await attempt([{ warehouseId, quantity: 1 }], other.lines[0]?.id ?? "")).toMatchObject({
      errors: [{ code: "NOT_FOUND", field: "orderLineId" }],
    });
    expect(await attempt([{ warehouseId: crypto.randomUUID(), quantity: 1 }])).toMatchObject({
      errors: [{ code: "NOT_FOUND", field: "warehouse" }],
    });
    expect(await attempt([{ warehouseId: emptyWarehouse?.id ?? "", quantity: 1 }])).toMatchObject({
      errors: [
        {
          code: "INSUFFICIENT_STOCK",
          field: "stocks",
          orderLines: [lineId],
          warehouse: emptyWarehouse?.id,
        },
      ],
    });
    expect(
      await fulfillOrder(db, { orderId: crypto.randomUUID(), userId: staffId, lines: [] }),
    ).toMatchObject({ errors: [{ code: "NOT_FOUND", field: "order" }] });

    expect(await stockOf(boots.id)).toMatchObject({ quantity: 5, quantityAllocated: 3 });
    expect(await db.select().from(schema.fulfillment)).toEqual([]);
  });

  it("doesn't take another order's allocated units", async () => {
    const boots = await seedVariant(1000, 3);
    const { order, lines } = await placeOrder([{ variantId: boots.id, quantity: 1 }]);
    await placeOrder([{ variantId: boots.id, quantity: 2 }]);
    // Stock shrinks to exactly what is allocated; the first order's own unit is still there.
    await updateVariantStocks(db, boots.id, [{ warehouseId, quantity: 3 }]);

    expect(await fulfillAll(order.id, [{ id: lines[0]?.id ?? "", quantity: 1 }])).toMatchObject({
      ok: true,
    });
    expect(await stockOf(boots.id)).toMatchObject({ quantity: 2, quantityAllocated: 2 });
    await expectAllocationsConsistent();
  });

  it("refuses a canceled order", async () => {
    const boots = await seedVariant(1000, 5);
    const { order, lines } = await placeOrder([{ variantId: boots.id, quantity: 1 }]);
    await cancelOrder(db, { orderId: order.id, userId: staffId });

    expect(await fulfillAll(order.id, lines)).toMatchObject({
      errors: [{ code: "INVALID", field: "order" }],
    });
  });
});

describe("cancelOrder", () => {
  it("releases the allocations and records the event", async () => {
    const boots = await seedVariant(1000, 5);
    const socks = await seedVariant(250);
    const { order, lines } = await placeOrder([
      { variantId: boots.id, quantity: 2 },
      { variantId: socks.id, quantity: 1 },
    ]);

    const result = await cancelOrder(db, { orderId: order.id, userId: staffId });
    expect(result).toMatchObject({ ok: true, order: { status: "CANCELED" } });
    expect(await stockOf(boots.id)).toMatchObject({ quantity: 5, quantityAllocated: 0 });
    expect(await allocationsOf(lines[0]?.id ?? "")).toEqual([]);
    const events = await getOrderEventsByOrderIds(db, [order.id]);
    expect(events.map((event) => [event.type, event.userId])).toEqual([
      ["PLACED", null],
      ["CANCELED", staffId],
    ]);
    await expectAllocationsConsistent();
  });

  it("refuses a canceled order, an order with a fulfillment and an unknown order", async () => {
    const boots = await seedVariant(1000, 5);
    const canceled = await placeOrder([{ variantId: boots.id, quantity: 1 }]);
    await cancelOrder(db, { orderId: canceled.order.id, userId: staffId });
    const fulfilled = await placeOrder([{ variantId: boots.id, quantity: 2 }]);
    await fulfillAll(fulfilled.order.id, [{ id: fulfilled.lines[0]?.id ?? "", quantity: 1 }]);

    for (const orderId of [canceled.order.id, fulfilled.order.id]) {
      expect(await cancelOrder(db, { orderId, userId: staffId })).toMatchObject({
        errors: [{ code: "CANNOT_CANCEL_ORDER", field: "order" }],
      });
    }
    expect(await cancelOrder(db, { orderId: crypto.randomUUID(), userId: null })).toMatchObject({
      errors: [{ code: "NOT_FOUND" }],
    });
    expect(await stockOf(boots.id)).toMatchObject({ quantity: 4, quantityAllocated: 1 });
  });
});

describe("refundOrderTransaction", () => {
  it("refunds the whole charge by default, records both events and the order event", async () => {
    const boots = await seedVariant(1000, 5);
    const { order } = await placeOrder([{ variantId: boots.id, quantity: 2 }]);
    const [transaction] = await getTransactionsByOrderIds(db, [order.id]);

    const result = await refundOrderTransaction(db, {
      transactionId: transaction?.id ?? "",
      amount: null,
      userId: staffId,
    });
    expect(result).toMatchObject({
      ok: true,
      transaction: { chargedAmount: 2500, refundedAmount: 2500 },
    });
    const paymentEvents = await db
      .select()
      .from(schema.paymentEvent)
      .where(eq(schema.paymentEvent.transactionId, transaction?.id ?? ""));
    expect(paymentEvents.map((event) => [event.type, event.amount])).toEqual([
      ["CHARGE_SUCCESS", 2500],
      ["REFUND_REQUEST", 2500],
      ["REFUND_SUCCESS", 2500],
    ]);
    const events = await getOrderEventsByOrderIds(db, [order.id]);
    expect(events.at(-1)).toMatchObject({
      type: "TRANSACTION_REFUND_REQUESTED",
      userId: staffId,
      payload: { amount: 2500, currency: "MNT", transactionReference: transaction?.pspReference },
    });
  });

  it("refunds part, caps an amount above what is left, then has nothing left", async () => {
    const boots = await seedVariant(1000, 5);
    const { order } = await placeOrder([{ variantId: boots.id, quantity: 2 }]);
    const [transaction] = await getTransactionsByOrderIds(db, [order.id]);
    const refund = (amount: number | null) =>
      refundOrderTransaction(db, { transactionId: transaction?.id ?? "", amount, userId: staffId });

    expect(await refund(1000)).toMatchObject({ ok: true, transaction: { refundedAmount: 1000 } });
    expect(await refund(9999)).toMatchObject({ ok: true, transaction: { refundedAmount: 2500 } });
    expect(await refund(null)).toMatchObject({
      ok: false,
      errors: [{ field: "id", code: "INVALID" }],
    });
    expect(await refund(0)).toMatchObject({ errors: [{ field: "amount", code: "INVALID" }] });
  });

  it("refuses an unknown transaction and a checkout's transaction", async () => {
    const boots = await seedVariant(1000, 5);
    const created = await createCheckout(db, {
      lines: [{ variantId: boots.id, quantity: 1 }],
      email: "buyer@example.com",
    });
    if (!created.ok) throw new Error("no checkout");
    const paid = await initializeCheckoutTransaction(db, created.checkout.id, {
      gatewayId: DUMMY_GATEWAY_ID,
    });
    if (!paid.ok) throw new Error("not paid");

    expect(
      await refundOrderTransaction(db, {
        transactionId: crypto.randomUUID(),
        amount: null,
        userId: staffId,
      }),
    ).toMatchObject({ errors: [{ code: "NOT_FOUND" }] });
    expect(
      await refundOrderTransaction(db, {
        transactionId: paid.transaction.id,
        amount: null,
        userId: staffId,
      }),
    ).toMatchObject({ errors: [{ code: "INVALID", field: "id" }] });
  });
});

describe("markOrderAsPaid", () => {
  it("refuses a fully charged order", async () => {
    const boots = await seedVariant(1000, 5);
    const { order } = await placeOrder([{ variantId: boots.id, quantity: 1 }]);

    expect(
      await markOrderAsPaid(db, { orderId: order.id, userId: staffId, transactionReference: null }),
    ).toMatchObject({ errors: [{ code: "TRANSACTION_ERROR", field: "transaction" }] });
    expect(await getTransactionsByOrderIds(db, [order.id])).toHaveLength(1);
  });

  it("charges what is left in a manual transaction and records the reference", async () => {
    const boots = await seedVariant(1000, 5);
    const { order } = await placeOrder([{ variantId: boots.id, quantity: 2 }]);
    const [transaction] = await getTransactionsByOrderIds(db, [order.id]);
    await refundOrderTransaction(db, {
      transactionId: transaction?.id ?? "",
      amount: 1000,
      userId: staffId,
    });

    const result = await markOrderAsPaid(db, {
      orderId: order.id,
      userId: staffId,
      transactionReference: "BANK-42",
    });
    expect(result).toMatchObject({ ok: true });
    const transactions = await getTransactionsByOrderIds(db, [order.id]);
    expect(transactions[1]).toMatchObject({
      provider: "manual",
      name: "Mark-as-paid transaction",
      chargedAmount: 1000,
      pspReference: "BANK-42",
    });
    const events = await getOrderEventsByOrderIds(db, [order.id]);
    expect(events.at(-1)).toMatchObject({
      type: "ORDER_MARKED_AS_PAID",
      userId: staffId,
      payload: { transactionReference: "BANK-42" },
    });
  });
});

describe("order events", () => {
  it("are append-only, except that a deleted staff user's id is cleared", async () => {
    const boots = await seedVariant(1000, 5);
    const { order } = await placeOrder([{ variantId: boots.id, quantity: 1 }]);
    await cancelOrder(db, { orderId: order.id, userId: staffId });

    await expect(
      db
        .update(schema.orderEvent)
        .set({ type: "PLACED" })
        .where(eq(schema.orderEvent.orderId, order.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(schema.orderEvent).where(eq(schema.orderEvent.orderId, order.id)),
    ).rejects.toThrow();
    await db.delete(schema.user).where(eq(schema.user.id, staffId));
    const events = await getOrderEventsByOrderIds(db, [order.id]);
    expect(events.map((event) => event.userId)).toEqual([null, null]);
  });
});

describe("order actions under concurrency", () => {
  it("fulfills a line once when two staff fulfill it at the same time", async () => {
    for (let round = 0; round < 5; round++) {
      const boots = await seedVariant(1000, 5);
      const { order, lines } = await placeOrder([{ variantId: boots.id, quantity: 2 }]);

      const results = await Promise.all([fulfillAll(order.id, lines), fulfillAll(order.id, lines)]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toMatchObject([
        { errors: [{ code: "FULFILL_ORDER_LINE" }] },
      ]);
      expect(await stockOf(boots.id)).toMatchObject({ quantity: 3, quantityAllocated: 0 });
    }
    await expectAllocationsConsistent();
  });

  it("lets either cancel or fulfill win, never both", async () => {
    for (let round = 0; round < 5; round++) {
      const boots = await seedVariant(1000, 5);
      const { order, lines } = await placeOrder([{ variantId: boots.id, quantity: 2 }]);

      const [canceled, fulfilled] = await Promise.all([
        cancelOrder(db, { orderId: order.id, userId: staffId }),
        fulfillAll(order.id, lines),
      ]);
      expect([canceled.ok, fulfilled.ok].filter(Boolean)).toHaveLength(1);
      const stock = await stockOf(boots.id);
      expect(stock).toMatchObject(
        canceled.ok ? { quantity: 5, quantityAllocated: 0 } : { quantity: 3, quantityAllocated: 0 },
      );
    }
    await expectAllocationsConsistent();
  });

  it("never refunds more than was charged", async () => {
    const boots = await seedVariant(1000, 5);
    const { order } = await placeOrder([{ variantId: boots.id, quantity: 2 }]);
    const [transaction] = await getTransactionsByOrderIds(db, [order.id]);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        refundOrderTransaction(db, {
          transactionId: transaction?.id ?? "",
          amount: 1000,
          userId: staffId,
        }),
      ),
    );
    // 2,500 charged: two refunds of 1,000, a third capped at 500, then nothing left.
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    const [after] = await getTransactionsByOrderIds(db, [order.id]);
    expect(after).toMatchObject({ chargedAmount: 2500, refundedAmount: 2500 });
  });

  it("does not deadlock with checkout completion and stock updates on the same variant", async () => {
    const boots = await seedVariant(1000, 100);
    const placed = await Promise.all(
      Array.from({ length: 5 }, () => placeOrder([{ variantId: boots.id, quantity: 1 }])),
    );
    const checkouts = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const created = await createCheckout(db, {
          lines: [{ variantId: boots.id, quantity: 1 }],
          email: "buyer@example.com",
        });
        if (!created.ok) throw new Error("no checkout");
        const id = created.checkout.id;
        await updateCheckoutAddress(db, id, "SHIPPING", ADDRESS);
        await updateCheckoutAddress(db, id, "BILLING", ADDRESS);
        await updateCheckoutDeliveryMethod(db, id, shippingMethodId);
        await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
        return id;
      }),
    );

    const outcomes = await Promise.allSettled([
      ...placed.map(({ order, lines }) => fulfillAll(order.id, lines)),
      ...checkouts.map((id) => completeCheckout(db, id)),
      ...placed.map((_, index) =>
        updateVariantStocks(db, boots.id, [{ warehouseId, quantity: 100 + index }]),
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toEqual([]);
    expect(await stockOf(boots.id)).toMatchObject({ quantityAllocated: 5 });
    await expectAllocationsConsistent();
  });
});
