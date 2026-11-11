import { closeDb, getDb, schema } from "@commerce/db";
import { ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createSession } from "../identity/index.ts";

// Saleor's `warehouse` / `warehouses`, against the real app and commerce_test database. The
// default row is inserted by the inventory migration (PLAN M3 decision 2), so tests never create
// it and only remove warehouses they added themselves.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group CASCADE');
  // Keep the migration's row and drop anything a failed earlier run left behind.
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));
});

afterAll(async () => {
  await closeDb();
});

const WAREHOUSE = `query ($id: ID) { warehouse(id: $id) { id name slug email } }`;
const WAREHOUSES = `{
  warehouses(first: 10) {
    totalCount
    edges { cursor node { id name slug email } }
  }
}`;

type WarehouseData = { id: string; name: string; slug: string; email: string };

describe("the seeded warehouse", () => {
  it("exists exactly once with the migration's values", async () => {
    const rows = await db.select().from(schema.warehouse);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Default Warehouse",
      slug: "default-warehouse",
      email: "",
    });
  });

  it("is listed by `warehouses` with Saleor's connection shape", async () => {
    const staff = await createStaff(db, ["MANAGE_SHIPPING"]);
    const [warehouse] = await db.select().from(schema.warehouse);
    if (!warehouse) throw new Error("the migration did not seed a warehouse");

    const result = await client.gql(WAREHOUSES, {}, staff.token);
    expect(result.body.errors).toBeUndefined();

    const data = result.body.data as {
      warehouses: {
        totalCount: number;
        edges: { cursor: string; node: WarehouseData }[];
      };
    };
    expect(data.warehouses.totalCount).toBe(1);
    expect(data.warehouses.edges).toHaveLength(1);
    expect(data.warehouses.edges[0]?.cursor).toEqual(expect.any(String));
    expect(data.warehouses.edges[0]?.node).toEqual({
      id: toGlobalId("Warehouse", warehouse.id),
      name: "Default Warehouse",
      slug: "default-warehouse",
      email: "",
    });
  });

  it("can be looked up by id; an unknown id is null and a missing id is an error", async () => {
    const staff = await createStaff(db, ["MANAGE_ORDERS"]);
    const [warehouse] = await db.select().from(schema.warehouse);
    if (!warehouse) throw new Error("the migration did not seed a warehouse");

    const found = await client.gql(
      WAREHOUSE,
      { id: toGlobalId("Warehouse", warehouse.id) },
      staff.token,
    );
    expect(found.body.errors).toBeUndefined();
    expect(found.body.data).toMatchObject({
      warehouse: {
        id: toGlobalId("Warehouse", warehouse.id),
        name: "Default Warehouse",
        slug: "default-warehouse",
        email: "",
      },
    });

    const unknown = await client.gql(
      WAREHOUSE,
      { id: toGlobalId("Warehouse", crypto.randomUUID()) },
      staff.token,
    );
    expect(unknown.body.errors).toBeUndefined();
    expect(unknown.body.data).toEqual({ warehouse: null });

    const missing = await client.gql(WAREHOUSE, {}, staff.token);
    expect(missing.body.errors?.[0]?.message).toBe("At least one of arguments is required: 'id'.");
  });

  it("orders warehouses by name, then id", async () => {
    await db.insert(schema.warehouse).values([
      { name: "Zeta Warehouse", slug: "zeta-warehouse" },
      { name: "Alpha Warehouse", slug: "alpha-warehouse" },
    ]);
    const staff = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(WAREHOUSES, {}, staff.token);
    const data = result.body.data as {
      warehouses: { totalCount: number; edges: { node: { name: string } }[] };
    };
    expect(data.warehouses.totalCount).toBe(3);
    expect(data.warehouses.edges.map((edge) => edge.node.name)).toEqual([
      "Alpha Warehouse",
      "Default Warehouse",
      "Zeta Warehouse",
    ]);
  });
});

describe("warehouse permissions", () => {
  const permissions = ["MANAGE_PRODUCTS", "MANAGE_ORDERS", "MANAGE_SHIPPING"] as const;

  it("denies anonymous callers and customers", async () => {
    for (const query of [WAREHOUSE, WAREHOUSES]) {
      expectPermissionDenied(await client.gql(query), [...permissions]);
    }

    const [customer] = await db
      .insert(schema.user)
      .values({ email: `${crypto.randomUUID()}@example.com` })
      .returning({ id: schema.user.id });
    if (!customer) throw new Error("no customer");
    const { token } = await createSession(db, customer.id);
    expectPermissionDenied(await client.gql(WAREHOUSE, {}, token), [...permissions]);
  });

  it("denies staff without one of the three permissions", async () => {
    const staff = await createStaff(db, ["MANAGE_SETTINGS"]);
    expectPermissionDenied(await client.gql(WAREHOUSE, {}, staff.token), [...permissions]);
    expectPermissionDenied(await client.gql(WAREHOUSES, {}, staff.token), [...permissions]);
  });

  it("allows each of MANAGE_PRODUCTS, MANAGE_ORDERS and MANAGE_SHIPPING", async () => {
    for (const permission of permissions) {
      const staff = await createStaff(db, [permission]);
      expect((await client.gql(WAREHOUSES, {}, staff.token)).body.errors).toBeUndefined();
    }
  });
});
