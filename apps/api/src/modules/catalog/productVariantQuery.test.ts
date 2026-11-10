import { closeDb, getDb } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createCategory, createProduct, createProductVariant, updateProduct } from "./index.ts";

// GraphQL contract tests use the real Yoga app and commerce_test database.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category CASCADE');
});

afterAll(async () => {
  await closeDb();
});

const QUERY = `query ($id: ID, $sku: String) {
  productVariant(id: $id, sku: $sku) {
    id name sku trackInventory
    price { amount currency }
    product { id name }
  }
}`;

const productId = (id: string) => toGlobalId("Product", id);
const variantId = (id: string) => toGlobalId("ProductVariant", id);

interface VariantData {
  id: string;
  name: string;
  sku: string | null;
  trackInventory: boolean;
  price: { amount: number; currency: string };
  product: { id: string; name: string };
}

/** A published product (published products need a category and a variant) with one variant. */
async function publishedVariant(sku: string | null = "BT-1") {
  const category = await createCategory(db, { name: "Boots" });
  if (!category.ok) throw new Error(JSON.stringify(category.errors));
  const product = await createProduct(db, {
    name: "Winter boots",
    categoryId: category.category.id,
  });
  if (!product.ok) throw new Error(JSON.stringify(product.errors));
  const variant = await createProductVariant(db, {
    productId: product.product.id,
    name: "Size 39",
    sku,
    price: "15000",
  });
  if (!variant.ok) throw new Error(JSON.stringify(variant.errors));
  const published = await updateProduct(db, product.product.id, { isPublished: true });
  if (!published.ok) throw new Error(JSON.stringify(published.errors));
  return { product: product.product, variant: variant.variant };
}

describe("productVariant query", () => {
  it("looks up a published variant by id and by SKU", async () => {
    const { product, variant } = await publishedVariant();

    const byId = await client.gql(QUERY, { id: variantId(variant.id) });
    expect(byId.body.errors).toBeUndefined();
    expect(byId.body.data).toEqual({
      productVariant: {
        id: variantId(variant.id),
        name: "Size 39",
        sku: "BT-1",
        trackInventory: true,
        price: { amount: 15000, currency: "MNT" },
        product: { id: productId(product.id), name: "Winter boots" },
      },
    });

    const bySku = await client.gql(QUERY, { sku: "BT-1" });
    expect(bySku.body.errors).toBeUndefined();
    expect((bySku.body.data as { productVariant: VariantData }).productVariant.id).toBe(
      variantId(variant.id),
    );
  });

  it("returns null for an unknown id or SKU", async () => {
    await publishedVariant();

    const unknownId = await client.gql(QUERY, { id: variantId(crypto.randomUUID()) });
    expect(unknownId.body.data).toEqual({ productVariant: null });

    const unknownSku = await client.gql(QUERY, { sku: "NOPE" });
    expect(unknownSku.body.data).toEqual({ productVariant: null });
  });

  it("hides a variant of an unpublished product from anonymous callers", async () => {
    const category = await createCategory(db, { name: "Hidden" });
    if (!category.ok) throw new Error(JSON.stringify(category.errors));
    const product = await createProduct(db, {
      name: "Unpublished boots",
      categoryId: category.category.id,
    });
    if (!product.ok) throw new Error(JSON.stringify(product.errors));
    const draft = await createProductVariant(db, {
      productId: product.product.id,
      sku: "DRAFT-1",
      price: "1000",
    });
    if (!draft.ok) throw new Error(JSON.stringify(draft.errors));

    const anonymous = await client.gql(QUERY, { sku: "DRAFT-1" });
    expect(anonymous.body.errors).toBeUndefined();
    expect(anonymous.body.data).toEqual({ productVariant: null });

    const staff = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const asStaff = await client.gql(QUERY, { sku: "DRAFT-1" }, staff.token);
    expect(asStaff.body.errors).toBeUndefined();
    expect((asStaff.body.data as { productVariant: VariantData }).productVariant).toMatchObject({
      id: variantId(draft.variant.id),
      sku: "DRAFT-1",
      product: { id: productId(product.product.id), name: "Unpublished boots" },
    });
  });

  it("requires exactly one of id and sku", async () => {
    const neither = await client.gql(QUERY);
    expect(neither.body.errors?.[0]?.message).toBe(
      "At least one of arguments is required: 'id', 'sku'.",
    );

    const both = await client.gql(QUERY, {
      id: variantId(crypto.randomUUID()),
      sku: "BT-1",
    });
    expect(both.body.errors?.[0]?.message).toBe("Argument 'id' cannot be combined with 'sku'");
  });
});
