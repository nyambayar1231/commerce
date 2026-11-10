import { builder } from "../../graphql/builder.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { Decimal, JSONString } from "../../graphql/scalars.ts";
import { ProductErrorType } from "./graphql.ts";
import {
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  NotFoundError,
  type ProductError,
  ProductNotFoundError,
  type ProductResult,
  type ProductRow,
  type ProductVariantResult,
  type ProductVariantRow,
  updateProduct,
  updateProductVariant,
} from "./index.ts";
import { ProductType, ProductVariantType } from "./productGraphql.ts";

// Saleor's productCreate/productUpdate/productDelete and their variant equivalents
// (saleor/graphql/product/mutations/), wired to the catalog module's domain functions.

const RICH_CONTENT = "\n\nRich text format. For reference see https://editorjs.io/";
const PERMISSION = "Requires one of the following permissions: MANAGE_PRODUCTS.";

const productInput = (name: "ProductInput" | "ProductCreateInput", description: string) =>
  builder.inputType(name, {
    description,
    fields: (t) => ({
      category: t.id({ description: "ID of the product's category." }),
      description: t.field({
        type: JSONString,
        description: `Product description.${RICH_CONTENT}`,
      }),
      isPublished: t.boolean({ description: "Determines if object is visible to customers." }),
      name: t.string({ description: "Product name." }),
      slug: t.string({ description: "Product slug." }),
    }),
  });

const ProductInput = productInput("ProductInput", "Fields required to update a product.");
const ProductCreateInput = productInput(
  "ProductCreateInput",
  "Fields required to create a product.",
);

const ProductVariantInput = builder.inputType("ProductVariantInput", {
  description: "Fields required to update a product variant.",
  fields: (t) => ({
    name: t.string({ description: "Variant name." }),
    price: t.field({ type: Decimal, description: "The price of the product variant." }),
    sku: t.string({ description: "Stock keeping unit." }),
    trackInventory: t.boolean({
      description:
        "Determines if the inventory of this variant should be tracked. If false, the quantity " +
        "won't change when customers buy this item.",
    }),
  }),
});

const ProductVariantCreateInput = builder.inputType("ProductVariantCreateInput", {
  description: "Fields required to create a product variant.",
  fields: (t) => ({
    name: t.string({ description: "Variant name." }),
    price: t.field({ type: Decimal, description: "The price of the product variant." }),
    sku: t.string({ description: "Stock keeping unit." }),
    trackInventory: t.boolean({
      description:
        "Determines if the inventory of this variant should be tracked. If false, the quantity " +
        "won't change when customers buy this item.",
    }),
    product: t.id({ required: true, description: "Product ID of which type is the variant." }),
  }),
});

type ProductPayload = { product: ProductRow | null; errors: ProductError[] };
type ProductVariantPayload = { variant: ProductVariantRow | null; errors: ProductError[] };

const productPayloadType = (name: string, description: string) =>
  builder.objectRef<ProductPayload>(name).implement({
    description,
    fields: (t) => ({
      product: t.field({ type: ProductType, nullable: true, resolve: (p) => p.product }),
      errors: t.field({ type: [ProductErrorType], resolve: (p) => p.errors }),
    }),
  });

const variantPayloadType = (name: string, description: string) =>
  builder.objectRef<ProductVariantPayload>(name).implement({
    description,
    fields: (t) => ({
      productVariant: t.field({
        type: ProductVariantType,
        nullable: true,
        resolve: (p) => p.variant,
      }),
      errors: t.field({ type: [ProductErrorType], resolve: (p) => p.errors }),
    }),
  });

const CREATE_DESCRIPTION = `Creates a new product.\n\n${PERMISSION}`;
const UPDATE_DESCRIPTION = `Updates an existing product.\n\n${PERMISSION}`;
const DELETE_DESCRIPTION = `Deletes a product.\n\n${PERMISSION}`;
const VARIANT_CREATE_DESCRIPTION = `Creates a new variant for a product.\n\n${PERMISSION}`;
const VARIANT_UPDATE_DESCRIPTION = `Updates an existing variant for product.\n\n${PERMISSION}`;
const VARIANT_DELETE_DESCRIPTION = `Deletes a product variant.\n\n${PERMISSION}`;

const ProductCreate = productPayloadType("ProductCreate", CREATE_DESCRIPTION);
const ProductUpdate = productPayloadType("ProductUpdate", UPDATE_DESCRIPTION);
const ProductDelete = productPayloadType("ProductDelete", DELETE_DESCRIPTION);
const ProductVariantCreate = variantPayloadType("ProductVariantCreate", VARIANT_CREATE_DESCRIPTION);
const ProductVariantUpdate = variantPayloadType("ProductVariantUpdate", VARIANT_UPDATE_DESCRIPTION);
const ProductVariantDelete = variantPayloadType("ProductVariantDelete", VARIANT_DELETE_DESCRIPTION);

/** Maps an unknown product, variant or category to Saleor's top-level node error. */
async function runProduct<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId(error.kind, id)));
    }
    if (error instanceof NotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId("Category", id)));
    }
    throw error;
  }
}

const productPayload = (result: ProductResult): ProductPayload =>
  result.ok ? { product: result.product, errors: [] } : { product: null, errors: result.errors };

const variantPayload = (result: ProductVariantResult): ProductVariantPayload =>
  result.ok ? { variant: result.variant, errors: [] } : { variant: null, errors: result.errors };

/** The category argument: omitted means unchanged, `null` unassigns, an ID is decoded. */
const categoryId = (category: string | null | undefined): string | null | undefined => {
  if (category === undefined) return undefined;
  if (category === null) return null;
  return fromGlobalId("Category", String(category));
};

builder.mutationField("productCreate", (t) =>
  t.field({
    type: ProductCreate,
    description: CREATE_DESCRIPTION,
    args: {
      input: t.arg({
        type: ProductCreateInput,
        required: true,
        description: "Fields required to create a product.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runProduct(() =>
        createProduct(ctx.db, {
          name: input.name ?? "",
          slug: input.slug ?? undefined,
          description: input.description,
          categoryId: categoryId(input.category) ?? undefined,
          isPublished: input.isPublished ?? undefined,
        }),
      );
      return productPayload(result);
    },
  }),
);

builder.mutationField("productUpdate", (t) =>
  t.field({
    type: ProductUpdate,
    description: UPDATE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a product to update." }),
      input: t.arg({
        type: ProductInput,
        required: true,
        description: "Fields required to update a product.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const productId = fromGlobalId("Product", String(id));
      const result = await runProduct(() =>
        updateProduct(ctx.db, productId, {
          name: input.name ?? undefined,
          slug: input.slug ?? undefined,
          description: input.description,
          categoryId: categoryId(input.category),
          isPublished: input.isPublished ?? undefined,
        }),
      );
      return productPayload(result);
    },
  }),
);

builder.mutationField("productDelete", (t) =>
  t.field({
    type: ProductDelete,
    description: DELETE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a product to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const product = await runProduct(() =>
        deleteProduct(ctx.db, fromGlobalId("Product", String(id))),
      );
      return { product, errors: [] };
    },
  }),
);

builder.mutationField("productVariantCreate", (t) =>
  t.field({
    type: ProductVariantCreate,
    description: VARIANT_CREATE_DESCRIPTION,
    args: {
      input: t.arg({
        type: ProductVariantCreateInput,
        required: true,
        description: "Fields required to create a product variant.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runProduct(() =>
        createProductVariant(ctx.db, {
          productId: fromGlobalId("Product", String(input.product)),
          sku: input.sku,
          name: input.name ?? undefined,
          trackInventory: input.trackInventory ?? undefined,
          price: input.price,
        }),
      );
      return variantPayload(result);
    },
  }),
);

builder.mutationField("productVariantUpdate", (t) =>
  t.field({
    type: ProductVariantUpdate,
    description: VARIANT_UPDATE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a product variant to update." }),
      input: t.arg({
        type: ProductVariantInput,
        required: true,
        description: "Fields required to update a product variant.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const variantId = fromGlobalId("ProductVariant", String(id));
      const result = await runProduct(() =>
        updateProductVariant(ctx.db, variantId, {
          sku: input.sku,
          name: input.name,
          trackInventory: input.trackInventory ?? undefined,
          price: input.price,
        }),
      );
      return variantPayload(result);
    },
  }),
);

builder.mutationField("productVariantDelete", (t) =>
  t.field({
    type: ProductVariantDelete,
    description: VARIANT_DELETE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a product variant to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runProduct(() =>
        deleteProductVariant(ctx.db, fromGlobalId("ProductVariant", String(id))),
      );
      return variantPayload(result);
    },
  }),
);
