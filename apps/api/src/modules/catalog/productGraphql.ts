import { type Money, parseDecimal } from "@commerce/contracts";
import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId } from "../../graphql/globalId.ts";
import { MoneyType } from "../../graphql/money.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { DateTime, Decimal, JSONString } from "../../graphql/scalars.ts";
import { CategoryType, OrderDirection } from "./graphql.ts";
import {
  getProduct,
  getProductVariant,
  InvalidCursorError,
  listProducts,
  type ProductListArgs,
  type ProductPage,
  type ProductRow,
  type ProductSortField,
  type ProductVariantRow,
  toMoney,
} from "./index.ts";
import {
  type ConditionFilter,
  type ProductWhere,
  SHOP_CURRENCY,
  type ValueFilter,
} from "./productWhere.ts";

const RICH_CONTENT = "\n\nRich text format. For reference see https://editorjs.io/";
const UNPUBLISHED_NOTE =
  "Requires one of the following permissions to include the unpublished items: MANAGE_PRODUCTS.";

// List rows also carry their minimal variant price, so the field needs no second query.
type ProductModel = ProductRow & { minimalPrice?: Money | null };

export const ProductType = builder.objectRef<ProductModel>("Product");
export const ProductVariantType = builder.objectRef<ProductVariantRow>("ProductVariant");

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

/**
 * The cheapest variant's price, as `getMinimalVariantPrice` does it in SQL: order by amount,
 * then id, and take the first. Null when the product has no variants.
 */
function minimalPriceOf(variants: ProductVariantRow[]): Money | null {
  let min: ProductVariantRow | null = null;
  for (const variant of variants) {
    if (
      min === null ||
      variant.priceAmount < min.priceAmount ||
      (variant.priceAmount === min.priceAmount && variant.id < min.id)
    ) {
      min = variant;
    }
  }
  return min === null ? null : toMoney(min.priceAmount, min.currency);
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

// Saleor's `Category.products` (saleor/graphql/product/types/categories.py, resolve_products):
// products of the category and all its descendants, visible like `products`.
builder.objectField(CategoryType, "products", (t) =>
  t.connection(
    {
      type: ProductType,
      nullable: true,
      description: `List of products in the category. ${UNPUBLISHED_NOTE}`,
      args: {
        search: t.arg.string({ description: "Search products." }),
      },
      resolve: async (category, { search, ...page }, ctx, info) => {
        const edgesRequested = isEdgesRequested(info);
        const includeUnpublished = await seesUnpublished(ctx);

        // A categories list row already knows the subtree's full product count. It counts
        // unpublished products too, so only callers that see them may use it (the mirror of the
        // `subcategoryCount` shortcut in `Category.children`).
        if (!edgesRequested && includeUnpublished && category.productCount !== undefined) {
          return {
            totalCount: category.productCount,
            edges: [],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: null,
            },
          };
        }

        return productConnection(
          ctx,
          "products",
          { ...page, search, categoryId: category.id },
          edgesRequested,
        );
      },
    },
    ProductConnection,
  ),
);

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
        product.categoryId === null ? null : ctx.loaders.categoryById.load(product.categoryId),
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
      resolve: async (product, _args, ctx) =>
        product.minimalPrice !== undefined
          ? product.minimalPrice
          : minimalPriceOf(await ctx.loaders.variantsByProductId.load(product.id)),
    }),
    defaultVariant: t.field({
      type: ProductVariantType,
      nullable: true,
      description: "Default variant of the product.",
      resolve: async (product, _args, ctx) =>
        (await ctx.loaders.variantsByProductId.load(product.id))[0] ?? null,
    }),
    variants: t.field({
      type: [ProductVariantType],
      description: "List of variants for the product.",
      resolve: (product, _args, ctx) => ctx.loaders.variantsByProductId.load(product.id),
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
        const product = await ctx.loaders.productById.load(variant.productId);
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

// Saleor's filter inputs for `where` (saleor/graphql/core/types/filters.py), reduced to the
// operators our fields implement.
const StringFilterInput = builder.inputType("StringFilterInput", {
  fields: (t) => ({
    eq: t.string({ description: "The value equal to." }),
    oneOf: t.stringList({ description: "The value included in." }),
  }),
});

const GlobalIDFilterInput = builder.inputType("GlobalIDFilterInput", {
  fields: (t) => ({
    eq: t.id({ description: "The value equal to." }),
    oneOf: t.idList({ description: "The value included in." }),
  }),
});

const DecimalRangeInput = builder.inputType("DecimalRangeInput", {
  fields: (t) => ({
    gte: t.field({ type: Decimal, description: "Decimal value greater than or equal to." }),
    lte: t.field({ type: Decimal, description: "Decimal value less than or equal to." }),
  }),
});

const DecimalFilterInput = builder.inputType("DecimalFilterInput", {
  fields: (t) => ({
    eq: t.field({ type: Decimal, description: "The value equal to." }),
    oneOf: t.field({ type: [Decimal], description: "The value included in." }),
    range: t.field({ type: DecimalRangeInput, description: "The value in range." }),
  }),
});

const DateTimeRangeInput = builder.inputType("DateTimeRangeInput", {
  fields: (t) => ({
    gte: t.field({ type: DateTime, description: "Start date." }),
    lte: t.field({ type: DateTime, description: "End date." }),
  }),
});

const DateTimeFilterInput = builder.inputType("DateTimeFilterInput", {
  fields: (t) => ({
    eq: t.field({ type: DateTime, description: "The value equal to." }),
    oneOf: t.field({ type: [DateTime], description: "The value included in." }),
    range: t.field({ type: DateTimeRangeInput, description: "The value in range." }),
  }),
});

// The GraphQL shape of a where object, before global IDs and decimal amounts are parsed.
interface ProductWhereData {
  ids?: readonly string[] | null;
  name?: { eq?: string | null; oneOf?: readonly string[] | null } | null;
  slug?: { eq?: string | null; oneOf?: readonly string[] | null } | null;
  category?: { eq?: string | null; oneOf?: readonly string[] | null } | null;
  hasCategory?: boolean | null;
  isPublished?: boolean | null;
  price?: DecimalFilterData | null;
  minimalPrice?: DecimalFilterData | null;
  updatedAt?: DateTimeFilterData | null;
  AND?: readonly ProductWhereData[] | null;
  OR?: readonly ProductWhereData[] | null;
}

interface DecimalFilterData {
  eq?: string | null;
  oneOf?: readonly string[] | null;
  range?: { gte?: string | null; lte?: string | null } | null;
}

interface DateTimeFilterData {
  eq?: Date | null;
  oneOf?: readonly Date[] | null;
  range?: { gte?: Date | null; lte?: Date | null } | null;
}

// Saleor's ProductWhereInput, with the subset of fields we can answer (saleor/graphql/schema.graphql).
// An explicit shape lets `AND`/`OR` refer to the input type inside its own definition.
const ProductWhereInput = builder.inputRef<ProductWhereData>("ProductWhereInput");
ProductWhereInput.implement({
  fields: (t) => ({
    ids: t.idList(),
    name: t.field({ type: StringFilterInput, description: "Filter by product name." }),
    slug: t.field({ type: StringFilterInput, description: "Filter by product slug." }),
    category: t.field({ type: GlobalIDFilterInput, description: "Filter by product category." }),
    hasCategory: t.boolean({ description: "Filter by product with category assigned." }),
    isPublished: t.boolean({ description: "Filter by public visibility." }),
    price: t.field({ type: DecimalFilterInput, description: "Filter by product variant price." }),
    minimalPrice: t.field({
      type: DecimalFilterInput,
      description: "Filter by the lowest variant price after discounts.",
    }),
    updatedAt: t.field({
      type: DateTimeFilterInput,
      description: "Filter by when was the most recent update.",
    }),
    AND: t.field({
      type: [ProductWhereInput],
      description: "List of conditions that must be met.",
    }),
    OR: t.field({
      type: [ProductWhereInput],
      description: "A list of conditions of which at least one must be met.",
    }),
  }),
});

/** A decimal amount from the API (number or numeric string) as minor units of the shop currency. */
function toMinorUnits(value: string): number {
  try {
    return parseDecimal(value, SHOP_CURRENCY).amountMinor;
  } catch (error) {
    // Saleor reports invalid decimals as a top-level GraphQL error, not as data.
    throw new GraphQLError(error instanceof Error ? error.message : "Invalid decimal value.");
  }
}

function toIdFilter(filter: NonNullable<ProductWhereData["category"]>, type: string): ValueFilter {
  return {
    eq: filter.eq === undefined || filter.eq === null ? filter.eq : fromGlobalId(type, filter.eq),
    oneOf: filter.oneOf?.map((id) => fromGlobalId(type, id)),
  };
}

function toDecimalFilter(filter: DecimalFilterData): ConditionFilter<number> {
  return {
    eq: filter.eq === undefined || filter.eq === null ? filter.eq : toMinorUnits(filter.eq),
    oneOf: filter.oneOf?.map(toMinorUnits),
    range:
      filter.range === undefined || filter.range === null
        ? filter.range
        : {
            gte:
              filter.range.gte === undefined || filter.range.gte === null
                ? filter.range.gte
                : toMinorUnits(filter.range.gte),
            lte:
              filter.range.lte === undefined || filter.range.lte === null
                ? filter.range.lte
                : toMinorUnits(filter.range.lte),
          },
  };
}

/** The GraphQL `where` input as the catalog module's typed where model. */
function toProductWhere(where: ProductWhereData): ProductWhere {
  const result: ProductWhere = {};
  if (where.ids !== undefined) {
    result.ids = where.ids === null ? null : where.ids.map((id) => fromGlobalId("Product", id));
  }
  if (where.name !== undefined) result.name = where.name;
  if (where.slug !== undefined) result.slug = where.slug;
  if (where.category !== undefined) {
    result.category = where.category === null ? null : toIdFilter(where.category, "Category");
  }
  if (where.hasCategory !== undefined) result.hasCategory = where.hasCategory;
  if (where.isPublished !== undefined) result.isPublished = where.isPublished;
  if (where.price !== undefined) {
    result.price = where.price === null ? null : toDecimalFilter(where.price);
  }
  if (where.minimalPrice !== undefined) {
    result.minimalPrice = where.minimalPrice === null ? null : toDecimalFilter(where.minimalPrice);
  }
  if (where.updatedAt !== undefined) result.updatedAt = where.updatedAt;
  if (where.AND !== undefined) result.AND = where.AND?.map(toProductWhere);
  if (where.OR !== undefined) result.OR = where.OR?.map(toProductWhere);
  return result;
}

builder.queryField("products", (t) =>
  t.connection(
    {
      type: ProductType,
      nullable: true,
      description: `List of the shop's products. ${UNPUBLISHED_NOTE}`,
      args: {
        search: t.arg.string({ description: "Search products." }),
        where: t.arg({
          type: ProductWhereInput,
          description: "Where filtering options for products.",
        }),
        sortBy: t.arg({ type: ProductOrder, description: "Sort products." }),
      },
      resolve: (_parent, { search, sortBy, where, ...page }, ctx, info) =>
        productConnection(
          ctx,
          "products",
          {
            ...page,
            search,
            where: where == null ? null : toProductWhere(where),
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

builder.queryField("productVariant", (t) =>
  t.field({
    type: ProductVariantType,
    nullable: true,
    description: `Look up a product variant by ID or SKU. ${UNPUBLISHED_NOTE}`,
    args: {
      id: t.arg.id({ description: "ID of the product variant." }),
      sku: t.arg.string({ description: "SKU of the product variant." }),
    },
    resolve: async (_parent, { id, sku }, ctx) => {
      const hasId = Boolean(id);
      const hasSku = Boolean(sku);
      if (hasId && hasSku) {
        throw new GraphQLError("Argument 'id' cannot be combined with 'sku'");
      }
      if (!hasId && !hasSku) {
        throw new GraphQLError("At least one of arguments is required: 'id', 'sku'.");
      }
      const variant = hasId
        ? await getProductVariant(ctx.db, { id: fromGlobalId("ProductVariant", String(id)) })
        : await getProductVariant(ctx.db, { sku: String(sku) });
      if (!variant) return null;

      const product = await ctx.loaders.productById.load(variant.productId);
      if (!product || !(await isVisible(product, ctx))) return null;
      return variant;
    },
  }),
);
