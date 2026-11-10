import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  type CategoryRow,
  createCategory,
  createProduct,
  createProductVariant,
  deleteCategory,
  deleteProduct,
  deleteProductVariant,
  getProduct,
  getProductVariants,
  NotFoundError,
  type ProductCreateInput,
  ProductNotFoundError,
  type ProductResult,
  type ProductRow,
  type ProductVariantCreateInput,
  type ProductVariantResult,
  type ProductVariantRow,
  updateProduct,
  updateProductVariant,
} from "./index.ts";

// Domain tests use the real (test) database.
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE category, product CASCADE");
});

afterAll(async () => {
  await closeDb();
});

async function mustCreateCategory(name = "Clothing"): Promise<CategoryRow> {
  const result = await createCategory(db, { name });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.category;
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

function expectFailure(result: ProductResult | ProductVariantResult) {
  if (result.ok) throw new Error("expected the mutation to fail");
  return result.errors;
}

/** A published product with a category and `variantCount` variants, built through the API. */
async function publishedProduct(variantCount = 1) {
  const category = await mustCreateCategory();
  const product = await mustCreateProduct({ name: "Boots", categoryId: category.id });
  for (let index = 0; index < variantCount; index += 1) {
    await mustCreateVariant({ productId: product.id, price: "1000", name: `Size ${index}` });
  }
  const result = await updateProduct(db, product.id, { isPublished: true });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { category, product: result.product };
}

describe("createProduct", () => {
  it("creates a product with a generated slug and EditorJS plaintext", async () => {
    const description = {
      time: 1,
      blocks: [{ data: { text: "<p>Warm <strong>boots</strong></p>" } }],
      version: "2.30.0",
    };
    const product = await mustCreateProduct({ name: "  Winter Boots  ", description });

    expect(product).toMatchObject({
      name: "Winter Boots",
      slug: "winter-boots",
      description,
      descriptionPlaintext: "Warm boots",
      categoryId: null,
      isPublished: false,
      publishedAt: null,
    });
  });

  it("generates the first free -2, -3, … slug suffix", async () => {
    const first = await mustCreateProduct({ name: "Gift Cards" });
    const second = await mustCreateProduct({ name: "Gift Cards" });
    const third = await mustCreateProduct({ name: "Gift Cards" });

    expect([first.slug, second.slug, third.slug]).toEqual([
      "gift-cards",
      "gift-cards-2",
      "gift-cards-3",
    ]);
  });

  it("collects name, slug, description and slug-uniqueness errors and writes nothing", async () => {
    await mustCreateProduct({ name: "Existing", slug: "taken" });

    expect(
      expectFailure(
        await createProduct(db, {
          name: "   ",
          slug: "not valid!",
          description: { blocks: "not-an-array" },
        }),
      ),
    ).toEqual([
      { field: "name", code: "REQUIRED", message: "This field cannot be blank." },
      {
        field: "slug",
        code: "INVALID",
        message: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
      },
      { field: "description", code: "INVALID", message: "Invalid EditorJS data." },
    ]);

    expect(expectFailure(await createProduct(db, { name: "Other", slug: "taken" }))).toEqual([
      { field: "slug", code: "UNIQUE", message: "Product with this Slug already exists." },
    ]);

    const tooLong = await createProduct(db, { name: "x".repeat(251) });
    expect(expectFailure(tooLong)).toEqual([
      {
        field: "name",
        code: "INVALID",
        message: "Ensure this value has at most 250 characters (it has 251).",
      },
    ]);

    expect(await db.select().from(schema.product)).toHaveLength(1);
  });

  it("throws NotFoundError for an unknown category", async () => {
    const categoryId = crypto.randomUUID();
    const pending = createProduct(db, { name: "Boots", categoryId });
    await expect(pending).rejects.toBeInstanceOf(NotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Category", ids: [categoryId] });
    expect(await db.select().from(schema.product)).toEqual([]);
  });

  it("refuses to create a published product, with or without a category", async () => {
    const category = await mustCreateCategory();

    expect(expectFailure(await createProduct(db, { name: "Boots", isPublished: true }))).toEqual([
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
    ]);

    expect(
      expectFailure(
        await createProduct(db, { name: "Boots", categoryId: category.id, isPublished: true }),
      ),
    ).toEqual([
      {
        field: "isPublished",
        code: "PRODUCT_WITHOUT_VARIANTS",
        message: "You must add at least one variant to be able to publish.",
      },
    ]);
    expect(await db.select().from(schema.product)).toEqual([]);
  });
});

describe("updateProduct", () => {
  it("changes name, slug and description and advances updatedAt", async () => {
    const before = await mustCreateProduct({ name: "Old" });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await updateProduct(db, before.id, {
      name: "  New name  ",
      slug: "new-slug",
      description: { blocks: [{ data: { text: "<p>New <em>copy</em></p>" } }] },
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.product).toMatchObject({
      id: before.id,
      name: "New name",
      slug: "new-slug",
      descriptionPlaintext: "New copy",
    });
    expect(result.product.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("rejects a blank name, blank or taken slug, invalid description and unknown category", async () => {
    const first = await mustCreateCategory("First");
    const product = await mustCreateProduct({ name: "Boots", categoryId: first.id });

    expect(
      expectFailure(
        await updateProduct(db, product.id, {
          name: " ",
          slug: "",
          description: { blocks: 42 },
        }),
      ),
    ).toEqual([
      { field: "name", code: "REQUIRED", message: "This field cannot be blank." },
      { field: "slug", code: "INVALID", message: "Slug value cannot be blank." },
      { field: "description", code: "INVALID", message: "Invalid EditorJS data." },
    ]);

    const takenSlug = await mustCreateProduct({ name: "Shoes", slug: "shoes" });
    expect(expectFailure(await updateProduct(db, product.id, { slug: takenSlug.slug }))).toEqual([
      { field: "slug", code: "UNIQUE", message: "Product with this Slug already exists." },
    ]);

    const unknown = crypto.randomUUID();
    const pending = updateProduct(db, product.id, { categoryId: unknown });
    await expect(pending).rejects.toBeInstanceOf(NotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Category", ids: [unknown] });

    // Null may be assigned explicitly, as long as the product stays unpublished.
    const cleared = await updateProduct(db, product.id, { categoryId: null });
    if (!cleared.ok) throw new Error(JSON.stringify(cleared.errors));
    expect(cleared.product.categoryId).toBeNull();
  });

  it("throws ProductNotFoundError for an unknown product", async () => {
    const id = crypto.randomUUID();
    const pending = updateProduct(db, id, { name: "New" });
    await expect(pending).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Product", ids: [id] });
  });

  it("publishes with a category and a variant, setting publishedAt", async () => {
    const { product } = await publishedProduct(1);

    expect(product.isPublished).toBe(true);
    expect(product.publishedAt).toBeInstanceOf(Date);
  });

  it("refuses to publish without a category and without variants", async () => {
    const category = await mustCreateCategory();
    const withoutCategory = await mustCreateProduct({ name: "Boots" });
    await mustCreateVariant({ productId: withoutCategory.id, price: "1000" });
    expect(
      expectFailure(await updateProduct(db, withoutCategory.id, { isPublished: true })),
    ).toEqual([
      {
        field: "category",
        code: "PRODUCT_WITHOUT_CATEGORY",
        message: "You must select a category to be able to publish.",
      },
    ]);

    const withoutVariants = await mustCreateProduct({ name: "Shoes", categoryId: category.id });
    expect(
      expectFailure(await updateProduct(db, withoutVariants.id, { isPublished: true })),
    ).toEqual([
      {
        field: "isPublished",
        code: "PRODUCT_WITHOUT_VARIANTS",
        message: "You must add at least one variant to be able to publish.",
      },
    ]);

    const [row] = await db
      .select()
      .from(schema.product)
      .where(eq(schema.product.id, withoutVariants.id));
    expect(row?.isPublished).toBe(false);
    expect(row?.publishedAt).toBeNull();
  });

  it("clears publishedAt on unpublish", async () => {
    const { product } = await publishedProduct(1);

    const result = await updateProduct(db, product.id, { isPublished: false });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.product.isPublished).toBe(false);
    expect(result.product.publishedAt).toBeNull();
  });

  it("refuses to unassign the category of a published product", async () => {
    const { product } = await publishedProduct(1);

    expect(expectFailure(await updateProduct(db, product.id, { categoryId: null }))).toEqual([
      {
        field: "category",
        code: "PRODUCT_WITHOUT_CATEGORY",
        message: "You must select a category to be able to publish.",
      },
    ]);
    const unchanged = await getProduct(db, { id: product.id });
    expect(unchanged?.categoryId).toBe(product.categoryId);
  });

  it("lets a published product be renamed even after its category is gone", async () => {
    const { product, category } = await publishedProduct(1);
    await deleteCategory(db, category.id);

    const result = await updateProduct(db, product.id, { name: "Renamed" });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.product).toMatchObject({ name: "Renamed", categoryId: null, isPublished: true });
  });
});

describe("createProductVariant", () => {
  it("stores trimmed SKUs, defaults the name and appends positions", async () => {
    const product = await mustCreateProduct({ name: "Boots" });

    const first = await mustCreateVariant({
      productId: product.id,
      price: "15000",
      sku: "  BT-1  ",
      name: "39",
    });
    const second = await mustCreateVariant({
      productId: product.id,
      price: "16000",
      sku: "   ",
    });
    const third = await mustCreateVariant({ productId: product.id, price: "0" });

    expect(first).toMatchObject({
      productId: product.id,
      sku: "BT-1",
      name: "39",
      priceAmount: 15000,
      currency: "MNT",
      trackInventory: true,
      position: 0,
    });
    expect(second).toMatchObject({ sku: null, name: "", position: 1 });
    expect(third).toMatchObject({ position: 2 });
  });

  it("reports a missing, negative or over-precise price", async () => {
    const product = await mustCreateProduct({ name: "Boots" });

    expect(expectFailure(await createProductVariant(db, { productId: product.id }))).toEqual([
      { field: "price", code: "REQUIRED", message: "This field is required." },
    ]);
    expect(
      expectFailure(await createProductVariant(db, { productId: product.id, price: "-1" })),
    ).toEqual([{ field: "price", code: "INVALID", message: "Price cannot be negative." }]);
    expect(
      expectFailure(await createProductVariant(db, { productId: product.id, price: "1.5" })),
    ).toEqual([
      {
        field: "price",
        code: "INVALID",
        message: "Value cannot have more than 0 decimal places.",
      },
    ]);
    expect(await db.select().from(schema.productVariant)).toEqual([]);
  });

  it("rejects a duplicate SKU in the service", async () => {
    const product = await mustCreateProduct({ name: "Boots" });
    await mustCreateVariant({ productId: product.id, price: "1000", sku: "BT-1" });

    expect(
      expectFailure(
        await createProductVariant(db, { productId: product.id, price: "2000", sku: " BT-1 " }),
      ),
    ).toEqual([
      {
        field: "sku",
        code: "UNIQUE",
        message: "Product variant with this SKU already exists.",
      },
    ]);
  });

  it("throws ProductNotFoundError for an unknown product", async () => {
    const productId = crypto.randomUUID();
    const pending = createProductVariant(db, { productId, price: "1000" });
    await expect(pending).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Product", ids: [productId] });
  });
});

describe("updateProductVariant", () => {
  it("changes sku, name, price and trackInventory and bumps the variant and product", async () => {
    const product = await mustCreateProduct({ name: "Boots" });
    const variant = await mustCreateVariant({ productId: product.id, price: "1000", sku: "BT-1" });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await updateProductVariant(db, variant.id, {
      sku: " BT-2 ",
      name: "Size 40",
      price: "2000",
      trackInventory: false,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    expect(result.variant).toMatchObject({
      id: variant.id,
      sku: "BT-2",
      name: "Size 40",
      priceAmount: 2000,
      trackInventory: false,
    });
    expect(result.variant.updatedAt.getTime()).toBeGreaterThan(variant.updatedAt.getTime());
    const bumped = await getProduct(db, { id: product.id });
    expect(bumped?.updatedAt.getTime()).toBeGreaterThan(product.updatedAt.getTime());
  });

  it("clears the SKU with null and rejects a duplicate one", async () => {
    const product = await mustCreateProduct({ name: "Boots" });
    const first = await mustCreateVariant({ productId: product.id, price: "1000", sku: "BT-1" });
    const second = await mustCreateVariant({ productId: product.id, price: "2000", sku: "BT-2" });

    expect(expectFailure(await updateProductVariant(db, second.id, { sku: "BT-1" }))).toEqual([
      { field: "sku", code: "UNIQUE", message: "Product variant with this SKU already exists." },
    ]);

    const cleared = await updateProductVariant(db, second.id, { sku: null });
    if (!cleared.ok) throw new Error(JSON.stringify(cleared.errors));
    expect(cleared.variant.sku).toBeNull();
    const unchanged = await updateProductVariant(db, first.id, { sku: "BT-1" });
    expect(unchanged.ok).toBe(true);
  });
});

describe("deleteProduct", () => {
  it("returns the deleted product and cascades its variants", async () => {
    const product = await mustCreateProduct({ name: "Boots" });
    await mustCreateVariant({ productId: product.id, price: "1000" });

    await expect(deleteProduct(db, product.id)).resolves.toMatchObject({ id: product.id });
    expect(await db.select().from(schema.product)).toEqual([]);
    expect(await db.select().from(schema.productVariant)).toEqual([]);
  });

  it("throws ProductNotFoundError for an unknown id", async () => {
    const id = crypto.randomUUID();
    await expect(deleteProduct(db, id)).rejects.toMatchObject({ kind: "Product", ids: [id] });
  });
});

describe("deleteProductVariant", () => {
  it("deletes a non-last variant of a published product", async () => {
    const { product } = await publishedProduct(2);
    const [first] = await getProductVariants(db, product.id);
    if (!first) throw new Error("no variant");

    const result = await deleteProductVariant(db, first.id);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.variant.id).toBe(first.id);
    expect(await getProductVariants(db, product.id)).toHaveLength(1);
  });

  it("refuses to delete the last variant of a published product", async () => {
    const { product } = await publishedProduct(1);
    const [variant] = await getProductVariants(db, product.id);
    if (!variant) throw new Error("no variant");

    expect(expectFailure(await deleteProductVariant(db, variant.id))).toEqual([
      {
        field: null,
        code: "PRODUCT_WITHOUT_VARIANTS",
        message: "Cannot delete the last variant of a published product. Unpublish it first.",
      },
    ]);
    expect(await getProductVariants(db, product.id)).toHaveLength(1);
  });

  it("deletes the last variant of an unpublished product", async () => {
    const product = await mustCreateProduct({ name: "Boots" });
    const variant = await mustCreateVariant({ productId: product.id, price: "1000" });

    const result = await deleteProductVariant(db, variant.id);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(await getProductVariants(db, product.id)).toEqual([]);
  });

  it("keeps a published product alive when two variant deletes run in parallel", async () => {
    const { product } = await publishedProduct(2);
    const [first, second] = await getProductVariants(db, product.id);
    if (!first || !second) throw new Error("expected two variants");

    const results = await Promise.all([
      db.transaction((tx) => deleteProductVariant(tx, first.id)),
      db.transaction((tx) => deleteProductVariant(tx, second.id)),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    const remaining = await getProductVariants(db, product.id);
    expect(remaining).toHaveLength(1);
    expect([first.id, second.id]).toContain(remaining[0]?.id);
  });
});
