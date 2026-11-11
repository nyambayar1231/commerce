import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createSession } from "../identity/index.ts";
import {
  createCategory,
  createProduct,
  createProductVariant,
  type ProductCreateInput,
  type ProductRow,
  type ProductVariantCreateInput,
  type ProductVariantRow,
} from "./index.ts";

// GraphQL contract tests use the real Yoga app and commerce_test database.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category CASCADE');
});

afterAll(async () => {
  await closeDb();
});

type ErrorData = { field: string | null; code: string; message: string };
type CategoryRef = { id: string };
type ProductData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: CategoryRef | null;
  isPublished: boolean;
  publishedAt: string | null;
};
type VariantData = {
  id: string;
  name: string;
  sku: string | null;
  trackInventory: boolean;
  price: { amount: number; currency: string };
};
type ProductPayloadData = { product: ProductData | null; errors: ErrorData[] };
type VariantPayloadData = { productVariant: VariantData | null; errors: ErrorData[] };

const PRODUCT_FIELDS = `product {
  id name slug description category { id } isPublished publishedAt
}`;
const VARIANT_FIELDS = `productVariant {
  id name sku trackInventory price { amount currency }
}`;
const ERRORS = "errors { field code message }";

const PRODUCT_CREATE = `mutation ($input: ProductCreateInput!) {
  productCreate(input: $input) { ${PRODUCT_FIELDS} ${ERRORS} }
}`;
const PRODUCT_UPDATE = `mutation ($id: ID!, $input: ProductInput!) {
  productUpdate(id: $id, input: $input) { ${PRODUCT_FIELDS} ${ERRORS} }
}`;
const PRODUCT_DELETE = `mutation ($id: ID!) {
  productDelete(id: $id) { ${PRODUCT_FIELDS} ${ERRORS} }
}`;
const VARIANT_CREATE = `mutation ($input: ProductVariantCreateInput!) {
  productVariantCreate(input: $input) { ${VARIANT_FIELDS} ${ERRORS} }
}`;
const VARIANT_UPDATE = `mutation ($id: ID!, $input: ProductVariantInput!) {
  productVariantUpdate(id: $id, input: $input) { ${VARIANT_FIELDS} ${ERRORS} }
}`;
const VARIANT_DELETE = `mutation ($id: ID!) {
  productVariantDelete(id: $id) { ${VARIANT_FIELDS} ${ERRORS} }
}`;

// `productVariantCreate` with `stocks` (PLAN M3.2): the payload's variant resolves the stock
// fields the inventory module adds.
const VARIANT_CREATE_WITH_STOCKS = `mutation ($input: ProductVariantCreateInput!) {
  productVariantCreate(input: $input) {
    productVariant {
      id
      quantityAvailable
      stocks { quantity quantityAllocated warehouse { id } }
    }
    errors { field code message }
  }
}`;

type VariantWithStocksData = VariantData & {
  quantityAvailable: number | null;
  stocks: { quantity: number; quantityAllocated: number; warehouse: { id: string } }[] | null;
};
type VariantWithStocksPayload = {
  productVariant: VariantWithStocksData | null;
  errors: ErrorData[];
};

/** The seeded warehouse's global ID. */
async function warehouseId(): Promise<string> {
  const [row] = await db
    .select()
    .from(schema.warehouse)
    .where(eq(schema.warehouse.slug, "default-warehouse"));
  if (!row) throw new Error("the migration did not seed a warehouse");
  return row.id;
}

const productId = (id: string) => toGlobalId("Product", id);
const variantId = (id: string) => toGlobalId("ProductVariant", id);
const categoryId = (id: string) => toGlobalId("Category", id);

function payload<T>(result: GqlResult, field: string): T {
  const root = result.body.data as Record<string, T> | null | undefined;
  const value = root?.[field];
  if (!value) throw new Error(`Missing ${field} payload: ${JSON.stringify(result.body)}`);
  return value;
}

async function mustCreateProduct(input: ProductCreateInput): Promise<ProductRow> {
  const result = await createProduct(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.product;
}

async function mustCreateVariant(input: ProductVariantCreateInput): Promise<ProductVariantRow> {
  const result = await createProductVariant(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.variant;
}

async function productWithVariant() {
  const product = await mustCreateProduct({ name: "Guarded" });
  const variant = await mustCreateVariant({ productId: product.id, price: "1000" });
  return { product, variant };
}

describe.each([
  {
    name: "productCreate",
    doc: PRODUCT_CREATE,
    vars: () => ({ input: { name: "Guarded" } }),
  },
  {
    name: "productUpdate",
    doc: PRODUCT_UPDATE,
    vars: async () => ({
      id: productId((await mustCreateProduct({ name: "Guarded" })).id),
      input: { name: "Changed" },
    }),
  },
  {
    name: "productDelete",
    doc: PRODUCT_DELETE,
    vars: async () => ({ id: productId((await mustCreateProduct({ name: "Guarded" })).id) }),
  },
  {
    name: "productVariantCreate",
    doc: VARIANT_CREATE,
    vars: async () => ({
      input: {
        product: productId((await mustCreateProduct({ name: "Guarded" })).id),
        price: "1000",
      },
    }),
  },
  {
    name: "productVariantUpdate",
    doc: VARIANT_UPDATE,
    vars: async () => ({
      id: variantId((await productWithVariant()).variant.id),
      input: { name: "Changed" },
    }),
  },
  {
    name: "productVariantDelete",
    doc: VARIANT_DELETE,
    vars: async () => ({ id: variantId((await productWithVariant()).variant.id) }),
  },
])("$name requires MANAGE_PRODUCTS", ({ name, doc, vars }) => {
  it("denies anonymous requests", async () => {
    expectPermissionDenied(await client.gql(doc, await vars()), ["MANAGE_PRODUCTS"]);
  });

  it("denies a customer", async () => {
    const [customer] = await db
      .insert(schema.user)
      .values({ email: `${crypto.randomUUID()}@example.com` })
      .returning({ id: schema.user.id });
    if (!customer) throw new Error("no customer");
    const { token } = await createSession(db, customer.id);
    expectPermissionDenied(await client.gql(doc, await vars(), token), ["MANAGE_PRODUCTS"]);
  });

  it("denies staff without MANAGE_PRODUCTS", async () => {
    const { token } = await createStaff(db, ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(doc, await vars(), token), ["MANAGE_PRODUCTS"]);
  });

  it("allows staff with MANAGE_PRODUCTS", async () => {
    const { token } = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(doc, await vars(), token);
    expect(result.body.errors).toBeUndefined();
    expect(payload<ProductPayloadData | VariantPayloadData>(result, name).errors).toEqual([]);
  });
});

describe("product mutations", () => {
  it("creates a product with a global ID, a generated slug and its category", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const category = await createCategory(db, { name: "Boots" });
    if (!category.ok) throw new Error(JSON.stringify(category.errors));
    const description = { blocks: [{ data: { text: "<p>Warm</p>" } }] };

    const result = await client.gql(
      PRODUCT_CREATE,
      {
        input: {
          name: "Winter Boots",
          description: JSON.stringify(description),
          category: categoryId(category.category.id),
        },
      },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    const created = payload<ProductPayloadData>(result, "productCreate").product;
    if (!created) throw new Error("expected a product");
    expect(created).toMatchObject({
      name: "Winter Boots",
      slug: "winter-boots",
      category: { id: categoryId(category.category.id) },
      isPublished: false,
      publishedAt: null,
    });
    expect(JSON.parse(created.description ?? "")).toEqual(description);

    const [row] = await db
      .select()
      .from(schema.product)
      .where(eq(schema.product.slug, "winter-boots"));
    if (!row) throw new Error("expected the product row");
    expect(created.id).toBe(productId(row.id));
  });

  it("returns Saleor's ProductError payload when publishing without a category", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await client.gql(
      PRODUCT_CREATE,
      { input: { name: "Boots", isPublished: true } },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    expect(payload<ProductPayloadData>(result, "productCreate")).toEqual({
      product: null,
      errors: [
        {
          field: "category",
          code: "PRODUCT_WITHOUT_CATEGORY",
          message: "You must select a category to be able to publish.",
        },
        {
          field: "isPublished",
          code: "PRODUCT_WITHOUT_VARIANTS",
          message: "You must add at least one variant to be able to publish.",
        },
      ],
    });
  });

  it("publishes a product with a category and a variant", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const category = await createCategory(db, { name: "Boots" });
    if (!category.ok) throw new Error(JSON.stringify(category.errors));
    const product = await mustCreateProduct({
      name: "Boots",
      categoryId: category.category.id,
    });
    await mustCreateVariant({ productId: product.id, price: "1000" });

    const result = await client.gql(
      PRODUCT_UPDATE,
      { id: productId(product.id), input: { isPublished: true } },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    const updated = payload<ProductPayloadData>(result, "productUpdate");
    expect(updated.errors).toEqual([]);
    expect(updated.product?.isPublished).toBe(true);
    expect(new Date(updated.product?.publishedAt ?? "").toISOString()).toBe(
      updated.product?.publishedAt,
    );
  });

  it("returns the deleted product and its variants are gone", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const { product } = await productWithVariant();

    const result = await client.gql(PRODUCT_DELETE, { id: productId(product.id) }, admin.token);
    expect(result.body.errors).toBeUndefined();
    expect(payload<ProductPayloadData>(result, "productDelete")).toMatchObject({
      product: { id: productId(product.id), name: "Guarded" },
      errors: [],
    });
    expect(await db.select().from(schema.productVariant)).toEqual([]);
  });

  it("reports unknown product and category ids as top-level errors", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const unknown = productId(crypto.randomUUID());

    const missingProduct = await client.gql(
      PRODUCT_UPDATE,
      { id: unknown, input: { name: "Missing" } },
      admin.token,
    );
    expect(missingProduct.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );

    const missingCategoryGlobalId = categoryId(crypto.randomUUID());
    const missingCategory = await client.gql(
      PRODUCT_CREATE,
      { input: { name: "Boots", category: missingCategoryGlobalId } },
      admin.token,
    );
    expect(missingCategory.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${missingCategoryGlobalId}"]'.`,
    );
  });
});

describe("product variant mutations", () => {
  it("creates a variant with a global ID and MNT price", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const product = await mustCreateProduct({ name: "Boots" });

    const result = await client.gql(
      VARIANT_CREATE,
      {
        input: {
          product: productId(product.id),
          name: "Size 39",
          sku: " BT-1 ",
          price: "15000",
          trackInventory: false,
        },
      },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    const created = payload<VariantPayloadData>(result, "productVariantCreate");
    expect(created.errors).toEqual([]);
    expect(created.productVariant).toMatchObject({
      name: "Size 39",
      sku: "BT-1",
      trackInventory: false,
      price: { amount: 15000, currency: "MNT" },
    });

    const [row] = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.sku, "BT-1"));
    if (!row) throw new Error("expected the variant row");
    expect(created.productVariant?.id).toBe(variantId(row.id));
  });

  it("updates and deletes a variant", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const product = await mustCreateProduct({ name: "Boots" });
    const first = await mustCreateVariant({ productId: product.id, price: "1000", name: "One" });
    const second = await mustCreateVariant({ productId: product.id, price: "2000", name: "Two" });

    const updated = await client.gql(
      VARIANT_UPDATE,
      { id: variantId(first.id), input: { name: "Updated", price: "3000" } },
      admin.token,
    );
    expect(updated.body.errors).toBeUndefined();
    expect(
      payload<VariantPayloadData>(updated, "productVariantUpdate").productVariant,
    ).toMatchObject({
      id: variantId(first.id),
      name: "Updated",
      price: { amount: 3000, currency: "MNT" },
    });

    const deleted = await client.gql(VARIANT_DELETE, { id: variantId(second.id) }, admin.token);
    expect(deleted.body.errors).toBeUndefined();
    expect(payload<VariantPayloadData>(deleted, "productVariantDelete")).toMatchObject({
      productVariant: { id: variantId(second.id), name: "Two" },
      errors: [],
    });
    expect(await db.select().from(schema.productVariant)).toHaveLength(1);
  });

  it("reports unknown product and variant ids as top-level errors", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    await mustCreateProduct({ name: "Boots" });
    const unknownProduct = productId(crypto.randomUUID());
    const unknownVariant = variantId(crypto.randomUUID());

    const create = await client.gql(
      VARIANT_CREATE,
      { input: { product: unknownProduct, price: "1000" } },
      admin.token,
    );
    expect(create.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknownProduct}"]'.`,
    );

    const update = await client.gql(
      VARIANT_UPDATE,
      { id: unknownVariant, input: { name: "Missing" } },
      admin.token,
    );
    expect(update.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknownVariant}"]'.`,
    );
  });

  it("creates a variant with stocks, visible in stocks and quantityAvailable", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const product = await mustCreateProduct({ name: "Boots" });
    const warehouse = toGlobalId("Warehouse", await warehouseId());

    const result = await client.gql(
      VARIANT_CREATE_WITH_STOCKS,
      {
        input: {
          product: productId(product.id),
          price: "1000",
          stocks: [{ warehouse, quantity: 4 }],
        },
      },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    const created = payload<VariantWithStocksPayload>(result, "productVariantCreate");
    expect(created.errors).toEqual([]);
    expect(created.productVariant).toMatchObject({
      quantityAvailable: 4,
      stocks: [{ quantity: 4, quantityAllocated: 0, warehouse: { id: warehouse } }],
    });
  });

  it("reports stock errors of productVariantCreate without creating the variant", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const product = await mustCreateProduct({ name: "Boots" });
    const warehouse = toGlobalId("Warehouse", await warehouseId());

    const duplicated = await client.gql(
      VARIANT_CREATE_WITH_STOCKS,
      {
        input: {
          product: productId(product.id),
          price: "1000",
          stocks: [
            { warehouse, quantity: 1 },
            { warehouse, quantity: 2 },
          ],
        },
      },
      admin.token,
    );
    expect(duplicated.body.errors).toBeUndefined();
    expect(payload<VariantWithStocksPayload>(duplicated, "productVariantCreate")).toEqual({
      productVariant: null,
      errors: [{ field: "stocks", code: "UNIQUE", message: "Duplicated warehouse ID." }],
    });
    expect(await db.select().from(schema.productVariant)).toEqual([]);

    const unknown = toGlobalId("Warehouse", crypto.randomUUID());
    const missing = await client.gql(
      VARIANT_CREATE_WITH_STOCKS,
      {
        input: {
          product: productId(product.id),
          price: "1000",
          stocks: [{ warehouse: unknown, quantity: 1 }],
        },
      },
      admin.token,
    );
    expect(missing.body.errors).toBeUndefined();
    expect(payload<VariantWithStocksPayload>(missing, "productVariantCreate")).toEqual({
      productVariant: null,
      errors: [
        {
          field: "warehouse",
          code: "GRAPHQL_ERROR",
          message: `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
        },
      ],
    });
    expect(await db.select().from(schema.productVariant)).toEqual([]);
  });
});
