import type { Money } from "@commerce/contracts";
import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId } from "../../graphql/globalId.ts";
import { MoneyType } from "../../graphql/money.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { DateTime, JSONString } from "../../graphql/scalars.ts";
import { CategoryType, OrderDirection } from "./graphql.ts";
import {
  getCategory,
  getMinimalVariantPrice,
  getProduct,
  getProductVariants,
  InvalidCursorError,
  listProducts,
  type ProductListArgs,
  type ProductPage,
  type ProductRow,
  type ProductSortField,
  type ProductVariantRow,
  toMoney,
} from "./index.ts";

const RICH_CONTENT = "\n\nRich text format. For reference see https://editorjs.io/";
const UNPUBLISHED_NOTE =
  "Requires one of the following permissions to include the unpublished items: MANAGE_PRODUCTS.";

// List rows also carry their minimal variant price, so the field needs no second query.
type ProductModel = ProductRow & { minimalPrice?: Money | null };

const ProductType = builder.objectRef<ProductModel>("Product");
const ProductVariantType = builder.objectRef<ProductVariantRow>("ProductVariant");

/** Staff with MANAGE_PRODUCTS see unpublished and future-dated products (ARCHITECTURE.md §8). */
async function seesUnpublished(ctx: Context): Promise<boolean> {
  return Boolean(ctx.user?.isStaff) && (await ctx.permissions()).includes("MANAGE_PRODUCTS");
}

async function isVisible(product: ProductRow, ctx: Context): Promise<boolean> {
  if (await seesUnpublished(ctx)) return true;
  return (
    product.isPublished &&
    (product.publishedAt === null || product.publishedAt.getTime() <= Date.now())
  );
}

// Saleor's ProductCountableConnection / ProductCountableEdge.
const ProductConnection = builder.connectionObject(
  {
    type: ProductType,
    name: "ProductCountableConnection",
    fields: (t) => ({
      totalCount: t.int({
        nullable: true,
        description: "A total count of items in the collection.",
        resolve: (connection) => (connection as unknown as ProductPage).totalCount,
      }),
    }),
  },
  { name: "ProductCountableEdge" },
);

/** One page of products in the connection shape, with Saleor's cursor errors. */
async function productConnection(
  ctx: Context,
  fieldName: string,
  args: ProductListArgs,
  edgesRequested: boolean,
) {
  const page = validatePagination(fieldName, args, edgesRequested);
  try {
    const result = await listProducts(ctx.db, {
      ...args,
      ...page,
      first: page.first,
      last: page.last,
      includeUnpublished: await seesUnpublished(ctx),
    });
    return {
      ...result,
      edges: result.rows,
      pageInfo: {
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
        startCursor: result.rows[0]?.cursor ?? null,
        endCursor: result.rows.at(-1)?.cursor ?? null,
      },
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) throw new GraphQLError(error.message);
    throw error;
  }
}

builder.node(ProductType, {
  id: { resolve: (product) => product.id, description: "The ID of the product." },
  description: "Represents an individual item for sale in the storefront.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "Name of the product." }),
    slug: t.exposeString("slug", { description: "Slug of the product." }),
    description: t.field({
      type: JSONString,
      nullable: true,
      description: `Description of the product.${RICH_CONTENT}`,
      resolve: (product) => product.description,
    }),
    category: t.field({
      type: CategoryType,
      nullable: true,
      description: "Category of the product.",
      resolve: (product, _args, ctx) =>
        product.categoryId === null ? null : getCategory(ctx.db, { id: product.categoryId }),
    }),
    created: t.field({
      type: DateTime,
      description: "The date and time when the product was created.",
      resolve: (product) => product.createdAt,
    }),
    updatedAt: t.field({
      type: DateTime,
      description: "The date and time when the product was last updated.",
      resolve: (product) => product.updatedAt,
    }),
    isPublished: t.exposeBoolean("isPublished", {
      description: "Indicates if the product is published.",
    }),
    publishedAt: t.field({
      type: DateTime,
      nullable: true,
      description: "The product publication date time.",
      resolve: (product) => product.publishedAt,
    }),
    minimalVariantPrice: t.field({
      type: MoneyType,
      nullable: true,
      description: "The minimal price of a product's variants.",
      resolve: (product, _args, ctx) =>
        product.minimalPrice !== undefined
          ? product.minimalPrice
          : getMinimalVariantPrice(ctx.db, product.id),
    }),
    defaultVariant: t.field({
      type: ProductVariantType,
      nullable: true,
      description: "Default variant of the product.",
      resolve: async (product, _args, ctx) =>
        (await getProductVariants(ctx.db, product.id))[0] ?? null,
    }),
    variants: t.field({
      type: [ProductVariantType],
      description: "List of variants for the product.",
      resolve: (product, _args, ctx) => getProductVariants(ctx.db, product.id),
    }),
  }),
});

builder.node(ProductVariantType, {
  id: { resolve: (variant) => variant.id, description: "The ID of the product variant." },
  description: "Represents a version of a product such as different size or color.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "The name of the product variant." }),
    sku: t.exposeString("sku", {
      nullable: true,
      description: "The SKU (stock keeping unit) of the product variant.",
    }),
    product: t.field({
      type: ProductType,
      description: "The product to which the variant belongs.",
      resolve: async (variant, _args, ctx) => {
        const product = await getProduct(ctx.db, { id: variant.productId });
        if (!product || !(await isVisible(product, ctx))) {
          throw new GraphQLError("Product not found.");
        }
        return product;
      },
    }),
    trackInventory: t.exposeBoolean("trackInventory", {
      description:
        "Determines if the inventory of this variant should be tracked. If false, the quantity " +
        "won't change when customers buy this item.",
    }),
    price: t.field({
      type: MoneyType,
      description: "The price of the product variant.",
      resolve: (variant) => toMoney(variant.priceAmount, variant.currency),
    }),
  }),
});

// Saleor's ProductOrderField, reduced to the fields we can sort by in one channel.
const ProductOrderField = builder.enumType("ProductOrderField", {
  values: {
    NAME: { description: "Sort products by name." },
    PRICE: { description: "Sort products by price." },
    PUBLISHED: { description: "Sort products by publication status." },
    CREATED_AT: { description: "Sort products by creation date." },
    LAST_MODIFIED_AT: { description: "Sort products by update date." },
  } as const,
});

const ProductOrder = builder.inputType("ProductOrder", {
  fields: (t) => ({
    direction: t.field({
      type: OrderDirection,
      required: true,
      description: "Specifies the direction in which to sort products.",
    }),
    field: t.field({
      type: ProductOrderField,
      description: "Sort products by the selected field.",
    }),
  }),
});

builder.queryField("products", (t) =>
  t.connection(
    {
      type: ProductType,
      nullable: true,
      description: `List of the shop's products. ${UNPUBLISHED_NOTE}`,
      args: {
        search: t.arg.string({ description: "Search products." }),
        sortBy: t.arg({ type: ProductOrder, description: "Sort products." }),
      },
      resolve: (_parent, { search, sortBy, ...page }, ctx, info) =>
        productConnection(
          ctx,
          "products",
          {
            ...page,
            search,
            sort: sortBy
              ? {
                  direction: sortBy.direction,
                  field: (sortBy.field ?? "NAME") as ProductSortField,
                }
              : null,
          },
          isEdgesRequested(info),
        ),
    },
    ProductConnection,
  ),
);

builder.queryField("product", (t) =>
  t.field({
    type: ProductType,
    nullable: true,
    description: `Look up a product by ID or slug. ${UNPUBLISHED_NOTE}`,
    args: {
      id: t.arg.id({ description: "ID of the product." }),
      slug: t.arg.string({ description: "Slug of the product." }),
    },
    resolve: async (_parent, { id, slug }, ctx) => {
      const hasId = Boolean(id);
      const hasSlug = Boolean(slug);
      if (hasId && hasSlug) {
        throw new GraphQLError("Argument 'id' cannot be combined with 'slug'");
      }
      if (!hasId && !hasSlug) {
        throw new GraphQLError("At least one of arguments is required: 'id', 'slug'.");
      }
      const product = hasId
        ? await getProduct(ctx.db, { id: fromGlobalId("Product", String(id)) })
        : await getProduct(ctx.db, { slug: String(slug) });
      if (!product || !(await isVisible(product, ctx))) return null;
      return product;
    },
  }),
);
