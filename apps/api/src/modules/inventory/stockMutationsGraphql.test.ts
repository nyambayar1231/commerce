import { closeDb, getDb, schema } from "@commerce/db";
import { ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import {
  createProduct,
  createProductVariant,
  type ProductRow,
  type ProductVariantRow,
} from "../catalog/index.ts";
import { createVariantStocks } from "./index.ts";

// Saleor's productVariantStocksCreate/Update/Delete through the real app and commerce_test.
const db = getDb();
const client = createTestClient(db);

let product: ProductRow;
let variant: ProductVariantRow;
let sku: string;
let firstWarehouse: string;
let secondWarehouse: string;

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, product CASCADE');
  // Keep the migration's row and drop extras a previous test or failed run left behind.
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));

  const [warehouse] = await db.select().from(schema.warehouse);
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  firstWarehouse = warehouse.id;
  const [second] = await db
    .insert(schema.warehouse)
    .values({ name: "Zeta Warehouse", slug: "zeta-warehouse" })
    .returning();
  if (!second) throw new Error("no second warehouse");
  secondWarehouse = second.id;

  product = await mustCreateProduct();
  sku = `SKU-${crypto.randomUUID()}`;
  variant = await mustCreateVariant(product, sku);
});

afterAll(async () => {
  await closeDb();
});

async function mustCreateProduct(): Promise<ProductRow> {
  const result = await createProduct(db, { name: "Boots" });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.product;
}

async function mustCreateVariant(product: ProductRow, sku: string): Promise<ProductVariantRow> {
  const result = await createProductVariant(db, { productId: product.id, price: "1000", sku });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.variant;
}

const variantId = (id: string) => toGlobalId("ProductVariant", id);
const warehouseId = (id: string) => toGlobalId("Warehouse", id);

type BulkStockErrorData = {
  field: string | null;
  code: string;
  message: string;
  index: number | null;
};
type StockErrorData = { field: string | null; code: string; message: string };
type StockData = {
  id: string;
  quantity: number;
  quantityAllocated: number;
  warehouse: { id: string };
};
type VariantData = {
  id: string;
  quantityAvailable: number | null;
  stocks: StockData[] | null;
};
type StockPayload<T> = { productVariant: VariantData | null; errors: T[] };

const VARIANT_FIELDS = `productVariant {
  id
  quantityAvailable
  stocks { id quantity quantityAllocated warehouse { id } }
}`;

const CREATE = `mutation ($variantId: ID!, $stocks: [StockInput!]!) {
  productVariantStocksCreate(variantId: $variantId, stocks: $stocks) {
    ${VARIANT_FIELDS}
    errors { field code message index }
  }
}`;
const UPDATE = `mutation ($variantId: ID, $sku: String, $stocks: [StockInput!]!) {
  productVariantStocksUpdate(variantId: $variantId, sku: $sku, stocks: $stocks) {
    ${VARIANT_FIELDS}
    errors { field code message index }
  }
}`;
const DELETE = `mutation ($variantId: ID, $sku: String, $warehouseIds: [ID!]) {
  productVariantStocksDelete(variantId: $variantId, sku: $sku, warehouseIds: $warehouseIds) {
    ${VARIANT_FIELDS}
    errors { field code message }
  }
}`;

function payloadOf<T>(result: GqlResult, field: string): T {
  const root = result.body.data as Record<string, T> | null | undefined;
  const value = root?.[field];
  if (!value) throw new Error(`Missing ${field} payload: ${JSON.stringify(result.body)}`);
  return value;
}

/** The payload of a stock mutation that must have succeeded. */
async function stocksOf(
  result: GqlResult,
  field: string,
): Promise<{ productVariant: VariantData; errors: unknown[] }> {
  expect(result.body.errors).toBeUndefined();
  const payload = payloadOf<{ productVariant: VariantData | null; errors: unknown[] }>(
    result,
    field,
  );
  expect(payload.errors).toEqual([]);
  if (!payload.productVariant) throw new Error("expected a product variant");
  return { productVariant: payload.productVariant, errors: payload.errors };
}

const quantityByWarehouse = (variantData: VariantData) =>
  Object.fromEntries(
    (variantData.stocks ?? []).map((stock) => [stock.warehouse.id, stock.quantity]),
  );

describe("productVariantStocksCreate", () => {
  it("creates the stocks and exposes them on the payload's variant", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(
      CREATE,
      {
        variantId: variantId(variant.id),
        stocks: [{ warehouse: warehouseId(firstWarehouse), quantity: 5 }],
      },
      admin.token,
    );

    const { productVariant } = await stocksOf(result, "productVariantStocksCreate");
    expect(productVariant).toEqual({
      id: variantId(variant.id),
      quantityAvailable: 5,
      stocks: [
        {
          id: expect.any(String),
          quantity: 5,
          quantityAllocated: 0,
          warehouse: { id: warehouseId(firstWarehouse) },
        },
      ],
    });
  });

  it("returns Saleor's payload errors for duplicate and negative stocks", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const warehouse = warehouseId(firstWarehouse);

    const duplicated = await client.gql(
      CREATE,
      {
        variantId: variantId(variant.id),
        stocks: [
          { warehouse, quantity: 1 },
          { warehouse, quantity: 2 },
        ],
      },
      admin.token,
    );
    expect(duplicated.body.errors).toBeUndefined();
    expect(
      payloadOf<StockPayload<BulkStockErrorData>>(duplicated, "productVariantStocksCreate"),
    ).toEqual({
      productVariant: null,
      errors: [
        { field: "warehouse", code: "UNIQUE", message: "Duplicated warehouse ID.", index: 1 },
      ],
    });

    const negative = await client.gql(
      CREATE,
      { variantId: variantId(variant.id), stocks: [{ warehouse, quantity: -1 }] },
      admin.token,
    );
    expect(
      payloadOf<StockPayload<BulkStockErrorData>>(negative, "productVariantStocksCreate").errors,
    ).toEqual([
      { field: "quantity", code: "INVALID", message: "Quantity can't be negative.", index: 0 },
    ]);
  });

  it("reports bad warehouse ids as payload errors, not top-level ones", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const create = (warehouse: string) =>
      client.gql(
        CREATE,
        { variantId: variantId(variant.id), stocks: [{ warehouse, quantity: 1 }] },
        admin.token,
      );
    const errorOf = async (warehouse: string) => {
      const result = await create(warehouse);
      expect(result.body.errors).toBeUndefined();
      return payloadOf<StockPayload<BulkStockErrorData>>(result, "productVariantStocksCreate")
        .errors;
    };

    expect(await errorOf("nope")).toEqual([
      {
        field: "warehouse",
        code: "GRAPHQL_ERROR",
        message: "Couldn't resolve id: nope.",
        index: null,
      },
    ]);

    const asProduct = toGlobalId("Product", product.id);
    expect(await errorOf(asProduct)).toEqual([
      {
        field: "warehouse",
        code: "GRAPHQL_ERROR",
        message: `Invalid ID: ${asProduct}. Expected: Warehouse, received: Product.`,
        index: null,
      },
    ]);

    const unknown = warehouseId(crypto.randomUUID());
    expect(await errorOf(unknown)).toEqual([
      {
        field: "warehouse",
        code: "GRAPHQL_ERROR",
        message: `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
        index: null,
      },
    ]);
  });
});

describe("productVariantStocksUpdate", () => {
  it("updates existing stocks and inserts a missing warehouse, by variant id", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const created = await createVariantStocks(db, variant.id, [
      { warehouseId: firstWarehouse, quantity: 1 },
    ]);
    expect(created.ok).toBe(true);

    const result = await client.gql(
      UPDATE,
      {
        variantId: variantId(variant.id),
        stocks: [
          { warehouse: warehouseId(firstWarehouse), quantity: 4 },
          { warehouse: warehouseId(secondWarehouse), quantity: 2 },
        ],
      },
      admin.token,
    );
    const { productVariant } = await stocksOf(result, "productVariantStocksUpdate");
    expect(productVariant.quantityAvailable).toBe(6);
    // Ordered by warehouse name: Default Warehouse, then Zeta Warehouse.
    expect(quantityByWarehouse(productVariant)).toEqual({
      [warehouseId(firstWarehouse)]: 4,
      [warehouseId(secondWarehouse)]: 2,
    });
  });

  it("updates by sku", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(
      UPDATE,
      { sku, stocks: [{ warehouse: warehouseId(firstWarehouse), quantity: 3 }] },
      admin.token,
    );
    const { productVariant } = await stocksOf(result, "productVariantStocksUpdate");
    expect(productVariant.id).toBe(variantId(variant.id));
    expect(productVariant.quantityAvailable).toBe(3);
  });

  it("requires exactly one of sku and variantId", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const stocks = [{ warehouse: warehouseId(firstWarehouse), quantity: 1 }];

    const both = await client.gql(
      UPDATE,
      { variantId: variantId(variant.id), sku, stocks },
      admin.token,
    );
    expect(both.body.errors).toBeUndefined();
    expect(payloadOf<StockPayload<BulkStockErrorData>>(both, "productVariantStocksUpdate")).toEqual(
      {
        productVariant: null,
        errors: [
          {
            field: null,
            code: "GRAPHQL_ERROR",
            message: "Argument 'sku' cannot be combined with 'variant_id'",
            index: null,
          },
        ],
      },
    );

    const neither = await client.gql(UPDATE, { stocks }, admin.token);
    expect(
      payloadOf<StockPayload<BulkStockErrorData>>(neither, "productVariantStocksUpdate").errors,
    ).toEqual([
      {
        field: null,
        code: "GRAPHQL_ERROR",
        message: "At least one of arguments is required: 'sku', 'variant_id'.",
        index: null,
      },
    ]);
  });

  it("reports an unknown sku in the payload and an unknown variant id at the top level", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const stocks = [{ warehouse: warehouseId(firstWarehouse), quantity: 1 }];

    const unknownSku = "MISSING-SKU";
    const bySku = await client.gql(UPDATE, { sku: unknownSku, stocks }, admin.token);
    expect(bySku.body.errors).toBeUndefined();
    expect(
      payloadOf<StockPayload<BulkStockErrorData>>(bySku, "productVariantStocksUpdate"),
    ).toEqual({
      productVariant: null,
      errors: [
        {
          field: "sku",
          code: "NOT_FOUND",
          message: "Couldn't resolve to a node: MISSING-SKU",
          index: null,
        },
      ],
    });

    const unknownVariant = variantId(crypto.randomUUID());
    const byId = await client.gql(UPDATE, { variantId: unknownVariant, stocks }, admin.token);
    expect(byId.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknownVariant}"]'.`,
    );
  });
});

describe("productVariantStocksDelete", () => {
  it("deletes the given warehouses, by sku, and ignores unknown ids", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const created = await createVariantStocks(db, variant.id, [
      { warehouseId: firstWarehouse, quantity: 2 },
      { warehouseId: secondWarehouse, quantity: 4 },
    ]);
    expect(created.ok).toBe(true);

    const result = await client.gql(
      DELETE,
      { sku, warehouseIds: [warehouseId(secondWarehouse), warehouseId(crypto.randomUUID())] },
      admin.token,
    );
    const { productVariant } = await stocksOf(result, "productVariantStocksDelete");
    expect(productVariant.quantityAvailable).toBe(2);
    expect(quantityByWarehouse(productVariant)).toEqual({
      [warehouseId(firstWarehouse)]: 2,
    });
  });

  it("requires exactly one of sku and variantId", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(
      DELETE,
      { variantId: variantId(variant.id), sku, warehouseIds: [] },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    expect(payloadOf<StockPayload<StockErrorData>>(result, "productVariantStocksDelete")).toEqual({
      productVariant: null,
      errors: [
        {
          field: null,
          code: "GRAPHQL_ERROR",
          message: "Argument 'sku' cannot be combined with 'variant_id'",
        },
      ],
    });
  });

  it("reports an unknown sku in the payload and bad warehouse ids on warehouseIds", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const bySku = await client.gql(DELETE, { sku: "MISSING-SKU" }, admin.token);
    expect(bySku.body.errors).toBeUndefined();
    expect(payloadOf<StockPayload<StockErrorData>>(bySku, "productVariantStocksDelete")).toEqual({
      productVariant: null,
      errors: [
        { field: "sku", code: "NOT_FOUND", message: "Couldn't resolve to a node: MISSING-SKU" },
      ],
    });

    const badIds = await client.gql(
      DELETE,
      { variantId: variantId(variant.id), warehouseIds: ["nope"] },
      admin.token,
    );
    expect(
      payloadOf<StockPayload<StockErrorData>>(badIds, "productVariantStocksDelete").errors,
    ).toEqual([
      { field: "warehouseIds", code: "GRAPHQL_ERROR", message: "Couldn't resolve id: nope." },
    ]);
  });
});

describe.each([
  {
    name: "productVariantStocksCreate",
    doc: CREATE,
    vars: () => ({
      variantId: variantId(variant.id),
      stocks: [{ warehouse: warehouseId(firstWarehouse), quantity: 1 }],
    }),
  },
  {
    name: "productVariantStocksUpdate",
    doc: UPDATE,
    vars: () => ({
      variantId: variantId(variant.id),
      stocks: [{ warehouse: warehouseId(firstWarehouse), quantity: 1 }],
    }),
  },
  {
    name: "productVariantStocksDelete",
    doc: DELETE,
    vars: () => ({ variantId: variantId(variant.id), warehouseIds: [] }),
  },
])("$name requires MANAGE_PRODUCTS", ({ name, doc, vars }) => {
  it("denies anonymous requests and staff without MANAGE_PRODUCTS, allows staff with it", async () => {
    expectPermissionDenied(await client.gql(doc, vars()), ["MANAGE_PRODUCTS"]);

    const shipping = await createStaff(db, ["MANAGE_SHIPPING"]);
    expectPermissionDenied(await client.gql(doc, vars(), shipping.token), ["MANAGE_PRODUCTS"]);

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(doc, vars(), admin.token);
    expect(result.body.errors).toBeUndefined();
    expect(payloadOf<{ errors: unknown[] }>(result, name).errors).toEqual([]);
  });
});
