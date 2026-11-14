import { closeDb, getDb, schema } from "@commerce/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  InvalidOrderCursorError,
  listOrders,
  type OrderListArgs,
  type OrderSortField,
} from "./index.ts";

// The staff orders list against the real (test) database (M6.1).
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "order", checkout, payment_transaction CASCADE');
});

afterAll(async () => {
  await closeDb();
});

const ADDRESS = { firstName: "A", lastName: "B", streetAddress1: "C", city: "D", country: "MN" };

type Seed = {
  email: string;
  status?: "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CANCELED";
  total?: number;
  charged?: number;
  createdAt?: string;
};

async function seedOrder(seed: Seed) {
  const total = seed.total ?? 1000;
  const [order] = await db
    .insert(schema.order)
    .values({
      status: seed.status ?? "UNFULFILLED",
      userEmail: seed.email,
      billingAddress: ADDRESS,
      shippingAddress: ADDRESS,
      shippingMethodName: "Standard",
      shippingPriceAmount: 0,
      subtotalAmount: total,
      totalAmount: total,
      currency: "MNT",
      ...(seed.createdAt
        ? { createdAt: sql`${seed.createdAt}::timestamptz` as unknown as Date }
        : {}),
    })
    .returning();
  if (!order) throw new Error("no order");
  if (seed.charged !== undefined) {
    await db.insert(schema.paymentTransaction).values({
      orderId: order.id,
      provider: "manual",
      name: "Manual",
      currency: "MNT",
      chargedAmount: seed.charged,
      idempotencyKey: crypto.randomUUID(),
    });
  }
  return order;
}

/** Every page of a list, following cursors in one direction. */
async function walk(args: OrderListArgs, pageSize: number, backwards = false) {
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const page = await listOrders(db, {
      ...args,
      ...(backwards ? { last: pageSize, before: cursor } : { first: pageSize, after: cursor }),
    });
    const ids = page.rows.map((row) => row.node.userEmail ?? "");
    if (backwards) seen.unshift(...ids);
    else seen.push(...ids);
    const more = backwards ? page.hasPreviousPage : page.hasNextPage;
    if (!more || page.rows.length === 0) return seen;
    cursor = (backwards ? page.rows[0] : page.rows.at(-1))?.cursor ?? null;
  }
  throw new Error("pagination did not end");
}

describe("listOrders", () => {
  it("defaults to number descending and counts every match", async () => {
    await seedOrder({ email: "a@example.com" });
    await seedOrder({ email: "b@example.com" });
    const page = await listOrders(db, { first: 10 });
    expect(page.rows.map((row) => row.node.userEmail)).toEqual(["b@example.com", "a@example.com"]);
    expect(page.totalCount).toBe(2);
  });

  it.each<[OrderSortField, string[]]>([
    ["CUSTOMER", ["a@example.com", "b@example.com", "c@example.com"]],
    ["FULFILLMENT_STATUS", ["c@example.com", "a@example.com", "b@example.com"]],
    ["PAYMENT", ["b@example.com", "a@example.com", "c@example.com"]],
    ["CREATED_AT", ["c@example.com", "a@example.com", "b@example.com"]],
  ])("sorts by %s ascending", async (field, expected) => {
    await seedOrder({
      email: "a@example.com",
      status: "FULFILLED",
      charged: 500,
      createdAt: "2026-01-02T00:00:00.000002Z",
    });
    await seedOrder({
      email: "b@example.com",
      status: "UNFULFILLED",
      createdAt: "2026-01-02T00:00:00.000003Z",
    });
    await seedOrder({
      email: "c@example.com",
      status: "CANCELED",
      charged: 1000,
      createdAt: "2026-01-02T00:00:00.000001Z",
    });
    const page = await listOrders(db, { first: 10, sort: { field, direction: "ASC" } });
    expect(page.rows.map((row) => row.node.userEmail)).toEqual(expected);
  });

  it("pages forwards and backwards without overlaps or gaps, even within one millisecond", async () => {
    const emails: string[] = [];
    for (let i = 0; i < 7; i++) {
      const email = `buyer${i}@example.com`;
      emails.push(email);
      // Seven orders created within the same millisecond, microseconds apart.
      await seedOrder({ email, createdAt: `2026-01-02T00:00:00.00010${i}Z` });
    }
    for (const field of ["CREATED_AT", "NUMBER", "CUSTOMER"] as const) {
      const sort = { field, direction: "ASC" as const };
      expect(await walk({ sort }, 3)).toEqual(emails);
      expect(await walk({ sort }, 3, true)).toEqual(emails);
    }
  });

  it("filters by status and searches by email or number", async () => {
    const first = await seedOrder({ email: "bat@example.com", status: "UNFULFILLED" });
    await seedOrder({ email: "dorj@example.com", status: "CANCELED" });

    const unfulfilled = await listOrders(db, {
      first: 10,
      where: { status: { eq: "UNFULFILLED" } },
    });
    expect(unfulfilled.rows.map((row) => row.node.id)).toEqual([first.id]);
    const either = await listOrders(db, {
      first: 10,
      where: { status: { oneOf: ["UNFULFILLED", "CANCELED"] } },
    });
    expect(either.totalCount).toBe(2);

    expect(
      (await listOrders(db, { first: 10, search: "DORJ" })).rows.map((r) => r.node.userEmail),
    ).toEqual(["dorj@example.com"]);
    expect(
      (await listOrders(db, { first: 10, search: String(first.number) })).rows.map(
        (r) => r.node.id,
      ),
    ).toEqual([first.id]);
  });

  it("rejects a cursor that doesn't belong to the sort", async () => {
    await seedOrder({ email: "a@example.com" });
    const page = await listOrders(db, { first: 1, sort: { field: "CUSTOMER", direction: "ASC" } });
    await expect(
      listOrders(db, {
        first: 1,
        after: page.rows[0]?.cursor,
        sort: { field: "NUMBER", direction: "ASC" },
      }),
    ).rejects.toThrow(InvalidOrderCursorError);
  });
});
