import { closeDb, getDb, schema } from "@commerce/db";
import { ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// `ProductVariant.stocks` (staff-only) and `ProductVariant.quantityAvailable` (public), as Saleor
// (saleor/graphql/product/types/products.py), against the real app and commerce_test database.
const db = getDb();
const client = createTestClient(db);

const TRACKED = "tracked";
const UNTRACKED = "untracked";
const NO_STOCK = "no-stock";

let variantIds: Record<string, string>;
let defaultWarehouseId: string;

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, product CASCADE');
  // Keep the migration's row and drop extras a previous test or failed run left behind.
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));

  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  defaultWarehouseId = warehouse.id;

  const suffix = crypto.randomUUID();
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Stocked Product", slug: `stocked-${suffix}`, isPublished: true })
    .returning();
  if (!product) throw new Error("no product");

  const variants = await db
    .insert(schema.productVariant)
    .values([
      {
        productId: product.id,
        sku: `SKU-${suffix}-1`,
        priceAmount: 1000,
        currency: "MNT",
      },
      {
        productId: product.id,
        sku: `SKU-${suffix}-2`,
        priceAmount: 1000,
        currency: "MNT",
        trackInventory: false,
      },
      {
        productId: product.id,
        sku: `SKU-${suffix}-3`,
        priceAmount: 1000,
        currency: "MNT",
      },
    ])
    .returning({ id: schema.productVariant.id });
  if (variants.length !== 3) throw new Error("expected three variants");
  variantIds = {
    [TRACKED]: variants[0]?.id ?? "",
    [UNTRACKED]: variants[1]?.id ?? "",
    [NO_STOCK]: variants[2]?.id ?? "",
  };

  await db.insert(schema.stock).values([
    {
      warehouseId: defaultWarehouseId,
      variantId: variantIds[TRACKED] ?? "",
      quantity: 10,
      quantityAllocated: 3,
    },
    // An untracked variant ignores its stock, but the row may exist.
    {
      warehouseId: defaultWarehouseId,
      variantId: variantIds[UNTRACKED] ?? "",
      quantity: 5,
      quantityAllocated: 0,
    },
  ]);
});

afterAll(async () => {
  await closeDb();
});

const QUANTITY = `query ($id: ID!) {
  productVariant(id: $id) { quantityAvailable }
}`;
const STOCKS = `query ($id: ID!) {
  productVariant(id: $id) {
    quantityAvailable
    stocks {
      id
      quantity
      quantityAllocated
      quantityReserved
      warehouse { id name slug email }
      productVariant { id sku }
    }
  }
}`;

type QuantityData = { productVariant: { quantityAvailable: number | null } | null };
type StockData = {
  productVariant: {
    quantityAvailable: number | null;
    stocks:
      | {
          id: string;
          quantity: number;
          quantityAllocated: number;
          quantityReserved: number;
          warehouse: { id: string; name: string; slug: string; email: string };
          productVariant: { id: string; sku: string | null };
        }[]
      | null;
  } | null;
};

const variantId = (key: string) => toGlobalId("ProductVariant", variantIds[key] ?? "");

describe("quantityAvailable", () => {
  it("is public: available stock for a tracked variant, 0 without stock, null when untracked", async () => {
    const tracked = await client.gql(QUANTITY, { id: variantId(TRACKED) });
    expect(tracked.body.errors).toBeUndefined();
    expect((tracked.body.data as QuantityData).productVariant?.quantityAvailable).toBe(7);

    const noStock = await client.gql(QUANTITY, { id: variantId(NO_STOCK) });
    expect((noStock.body.data as QuantityData).productVariant?.quantityAvailable).toBe(0);

    const untracked = await client.gql(QUANTITY, { id: variantId(UNTRACKED) });
    expect((untracked.body.data as QuantityData).productVariant?.quantityAvailable).toBeNull();
  });

  it("sums the available quantity across warehouses", async () => {
    const [second] = await db
      .insert(schema.warehouse)
      .values({ name: "Zeta Warehouse", slug: "zeta-warehouse" })
      .returning();
    if (!second) throw new Error("no second warehouse");
    await db.insert(schema.stock).values({
      warehouseId: second.id,
      variantId: variantIds[TRACKED] ?? "",
      quantity: 4,
      quantityAllocated: 1,
    });

    const result = await client.gql(QUANTITY, { id: variantId(TRACKED) });
    expect((result.body.data as QuantityData).productVariant?.quantityAvailable).toBe(10);
  });
});

describe("stocks", () => {
  it("is staff-only and exposes the stock row's quantities and relations", async () => {
    const admin = await createStaff(db, ["MANAGE_ORDERS"]);
    const result = await client.gql(STOCKS, { id: variantId(TRACKED) }, admin.token);
    expect(result.body.errors).toBeUndefined();

    const data = result.body.data as StockData;
    expect(data.productVariant?.quantityAvailable).toBe(7);
    expect(data.productVariant?.stocks).toEqual([
      {
        id: expect.any(String),
        quantity: 10,
        quantityAllocated: 3,
        quantityReserved: 0,
        warehouse: {
          id: toGlobalId("Warehouse", defaultWarehouseId),
          name: "Default Warehouse",
          slug: "default-warehouse",
          email: "",
        },
        productVariant: { id: variantId(TRACKED), sku: expect.any(String) },
      },
    ]);
  });

  it("denies anonymous callers and staff without MANAGE_PRODUCTS or MANAGE_ORDERS", async () => {
    const permissions = ["MANAGE_PRODUCTS", "MANAGE_ORDERS"] as const;
    expectPermissionDenied(await client.gql(STOCKS, { id: variantId(TRACKED) }), [...permissions]);

    const shipping = await createStaff(db, ["MANAGE_SHIPPING"]);
    expectPermissionDenied(await client.gql(STOCKS, { id: variantId(TRACKED) }, shipping.token), [
      ...permissions,
    ]);
  });

  it("orders stocks by warehouse name", async () => {
    const [second] = await db
      .insert(schema.warehouse)
      .values({ name: "Zeta Warehouse", slug: "zeta-warehouse" })
      .returning();
    if (!second) throw new Error("no second warehouse");
    await db
      .insert(schema.stock)
      .values({ warehouseId: second.id, variantId: variantIds[TRACKED] ?? "", quantity: 4 });

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(STOCKS, { id: variantId(TRACKED) }, admin.token);
    const data = result.body.data as StockData;
    expect(data.productVariant?.stocks?.map((stock) => stock.warehouse.name)).toEqual([
      "Default Warehouse",
      "Zeta Warehouse",
    ]);
  });
});
