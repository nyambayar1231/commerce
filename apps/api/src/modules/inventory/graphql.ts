import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { requirePermission } from "../../graphql/permissions.ts";
// GraphQL layer: object refs are imported from catalog's GraphQL files, not its index.ts
// (ARCHITECTURE §2 rule 2).
import { ProductErrorCode } from "../catalog/graphql.ts";
import {
  getProductVariant,
  ProductNotFoundError,
  type ProductVariantRow,
} from "../catalog/index.ts";
import { ProductVariantType } from "../catalog/productGraphql.ts";
import { StockInput } from "../catalog/productMutations.ts";
import {
  availableQuantity,
  createVariantStocks,
  deleteVariantStocks,
  getWarehouse,
  InvalidCursorError,
  listWarehouses,
  type StockInput as StockInputData,
  type StockRow,
  updateVariantStocks,
  type VariantStocksResult,
  type WarehouseListArgs,
  WarehouseNotFoundError,
  type WarehousePage,
  type WarehouseRow,
} from "./index.ts";

// Saleor's `Warehouse` and `Stock` (saleor/graphql/warehouse/types.py, schema.py). Read-only in
// M3.1: the warehouse row is seeded by the migration and stock rows are written by M3.2.
const MANAGE_STOCK = "Requires one of the following permissions: MANAGE_PRODUCTS, MANAGE_ORDERS.";
const MANAGE_WAREHOUSES =
  "Requires one of the following permissions: MANAGE_PRODUCTS, MANAGE_ORDERS, MANAGE_SHIPPING.";

export const WarehouseType = builder.objectRef<WarehouseRow>("Warehouse");
export const StockType = builder.objectRef<StockRow>("Stock");

// Saleor's WarehouseCountableConnection / WarehouseCountableEdge, used by `warehouses`.
const WarehouseConnection = builder.connectionObject(
  {
    type: WarehouseType,
    name: "WarehouseCountableConnection",
    fields: (t) => ({
      totalCount: t.int({
        nullable: true,
        description: "A total count of items in the collection.",
        resolve: (connection) => (connection as unknown as WarehousePage).totalCount,
      }),
    }),
  },
  { name: "WarehouseCountableEdge" },
);

/** One page of warehouses in the connection shape, with Saleor's cursor errors. */
async function warehouseConnection(
  ctx: Context,
  fieldName: string,
  args: WarehouseListArgs,
  edgesRequested: boolean,
) {
  const page = validatePagination(fieldName, args, edgesRequested);
  try {
    const result = await listWarehouses(ctx.db, {
      ...args,
      ...page,
      first: page.first,
      last: page.last,
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

// A Relay node (implements Node), as Saleor's Warehouse. Its address, channels, shipping zones and
// click-and-collect fields arrive with the features that need them (PLAN M3 decisions 2–3).
builder.node(WarehouseType, {
  id: { resolve: (warehouse) => warehouse.id, description: "The ID of the warehouse." },
  description: "Represents warehouse.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "Warehouse name." }),
    slug: t.exposeString("slug", { description: "Warehouse slug." }),
    email: t.exposeString("email", { description: "Warehouse email." }),
  }),
});

// Saleor's Stock (saleor/graphql/warehouse/types.py). `quantityReserved` is always 0 until
// checkout reservations exist (ARCHITECTURE.md §12).
builder.node(StockType, {
  id: { resolve: (stock) => stock.id, description: "The ID of stock." },
  description: "Represents stock.",
  fields: (t) => ({
    warehouse: t.field({
      type: WarehouseType,
      description: "The warehouse associated with the stock.",
      resolve: async (stock, _args, ctx) => {
        const warehouse = await ctx.inventoryLoaders.warehouseById.load(stock.warehouseId);
        if (warehouse === null) throw new GraphQLError("Warehouse not found.");
        return warehouse;
      },
    }),
    productVariant: t.field({
      type: ProductVariantType,
      description: "Information about the product variant.",
      resolve: async (stock, _args, ctx) => {
        const variant = await ctx.inventoryLoaders.productVariantById.load(stock.variantId);
        if (variant === null) throw new GraphQLError("Product variant not found.");
        return variant;
      },
    }),
    quantity: t.int({
      description: `Quantity of a product in the warehouse's possession, including the allocated stock that is waiting for shipment.\n\n${MANAGE_STOCK}`,
      resolve: async (stock, _args, ctx) => {
        await requirePermission(ctx, "MANAGE_PRODUCTS", "MANAGE_ORDERS");
        return stock.quantity;
      },
    }),
    quantityAllocated: t.int({
      description: `Quantity allocated for orders.\n\n${MANAGE_STOCK}`,
      resolve: async (stock, _args, ctx) => {
        await requirePermission(ctx, "MANAGE_PRODUCTS", "MANAGE_ORDERS");
        return stock.quantityAllocated;
      },
    }),
    quantityReserved: t.int({
      description: `Quantity reserved for checkouts.\n\n${MANAGE_STOCK}`,
      resolve: async (_stock, _args, ctx) => {
        await requirePermission(ctx, "MANAGE_PRODUCTS", "MANAGE_ORDERS");
        return 0;
      },
    }),
  }),
});

// Saleor's ProductVariant.stocks (saleor/graphql/product/types/products.py). Staff-only; ordered
// by warehouse name, then id (see inventory/stocks.ts).
builder.objectField(ProductVariantType, "stocks", (t) =>
  t.field({
    type: [StockType],
    nullable: true,
    description: `Stocks for the product variant.\n\n${MANAGE_STOCK}`,
    resolve: async (variant, _args, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS", "MANAGE_ORDERS");
      return ctx.inventoryLoaders.stocksByVariantId.load(variant.id);
    },
  }),
);

// Saleor's ProductVariant.quantityAvailable, public: the sum of available stock. Null when the
// variant doesn't track inventory. Saleor also applies the shop's limitQuantityPerCheckout and
// accepts an address/country; we have neither, so those arguments and the limit are left out.
builder.objectField(ProductVariantType, "quantityAvailable", (t) =>
  t.int({
    nullable: true,
    description:
      "Quantity of a product available for sale in one checkout. Field value will be `null` " +
      "when `productVariant` stocks are not tracked.",
    resolve: async (variant, _args, ctx) => {
      if (!variant.trackInventory) return null;
      return availableQuantity(await ctx.inventoryLoaders.stocksByVariantId.load(variant.id));
    },
  }),
);

builder.queryField("warehouse", (t) =>
  t.field({
    type: WarehouseType,
    nullable: true,
    description: `Look up a warehouse by ID.\n\n${MANAGE_WAREHOUSES}`,
    args: {
      id: t.arg.id({ description: "ID of a warehouse." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS", "MANAGE_ORDERS", "MANAGE_SHIPPING");
      // Saleor also accepts an externalReference here; we have neither external references nor a
      // second selector, so a missing id is the same "exactly one" error with one name.
      if (id == null) {
        throw new GraphQLError("At least one of arguments is required: 'id'.");
      }
      return getWarehouse(ctx.db, fromGlobalId("Warehouse", String(id)));
    },
  }),
);

builder.queryField("warehouses", (t) =>
  t.connection(
    {
      type: WarehouseType,
      nullable: true,
      description: `List of warehouses.\n\n${MANAGE_WAREHOUSES}`,
      resolve: async (_parent, { ...page }, ctx, info) => {
        await requirePermission(ctx, "MANAGE_PRODUCTS", "MANAGE_ORDERS", "MANAGE_SHIPPING");
        return warehouseConnection(ctx, "warehouses", page, isEdgesRequested(info));
      },
    },
    WarehouseConnection,
  ),
);

// ---------------------------------------------------------------------------------------------
// Stock writes: Saleor's productVariantStocksCreate/Update/Delete
// (saleor/graphql/product/bulk_mutations/product_variant_stocks_*.py).

const MANAGE_PRODUCTS_PERMISSION = "Requires one of the following permissions: MANAGE_PRODUCTS.";
const FIELD_DESCRIPTION =
  "Name of a field that caused the error. A value of `null` indicates that the error isn't " +
  "associated with a particular field.";
const MESSAGE_DESCRIPTION = "The error message.";
const CODE_DESCRIPTION = "The error code.";

type ProductErrorCodeValue = (typeof ProductErrorCode)["$inferType"];

/** The GraphQL shape of a stock error: the domain's narrower code, plus the GraphQL-only ones. */
type BulkStockErrorData = {
  field: string | null;
  code: ProductErrorCodeValue;
  message: string;
  index: number | null;
};

const BulkStockErrorType = builder.objectRef<BulkStockErrorData>("BulkStockError").implement({
  fields: (t) => ({
    field: t.exposeString("field", { nullable: true, description: FIELD_DESCRIPTION }),
    message: t.exposeString("message", { description: MESSAGE_DESCRIPTION }),
    code: t.field({
      type: ProductErrorCode,
      description: CODE_DESCRIPTION,
      resolve: (error) => error.code,
    }),
    index: t.exposeInt("index", {
      nullable: true,
      description: "Index of an input list item that caused the error.",
    }),
  }),
});

const StockErrorCode = builder.enumType("StockErrorCode", {
  values: [
    "ALREADY_EXISTS",
    "GRAPHQL_ERROR",
    "INVALID",
    "NOT_FOUND",
    "REQUIRED",
    "UNIQUE",
  ] as const,
});

type StockErrorCodeValue = (typeof StockErrorCode)["$inferType"];
type StockErrorData = { field: string | null; code: StockErrorCodeValue; message: string };

const StockErrorType = builder.objectRef<StockErrorData>("StockError").implement({
  fields: (t) => ({
    field: t.exposeString("field", { nullable: true, description: FIELD_DESCRIPTION }),
    message: t.exposeString("message", { description: MESSAGE_DESCRIPTION }),
    code: t.field({
      type: StockErrorCode,
      description: CODE_DESCRIPTION,
      resolve: (error) => error.code,
    }),
  }),
});

type StocksPayload = { productVariant: ProductVariantRow | null; errors: BulkStockErrorData[] };
type StocksDeletePayload = { productVariant: ProductVariantRow | null; errors: StockErrorData[] };

const CREATE_DESCRIPTION = `Creates stocks for product variant.\n\n${MANAGE_PRODUCTS_PERMISSION}`;
const UPDATE_DESCRIPTION = `Updates stocks for product variant.\n\n${MANAGE_PRODUCTS_PERMISSION}`;
const DELETE_DESCRIPTION = `Deletes stocks from product variant.\n\n${MANAGE_PRODUCTS_PERMISSION}`;

const ProductVariantStocksCreate = builder
  .objectRef<StocksPayload>("ProductVariantStocksCreate")
  .implement({
    description: CREATE_DESCRIPTION,
    fields: (t) => ({
      productVariant: t.field({
        type: ProductVariantType,
        nullable: true,
        description: "Updated product variant.",
        resolve: (payload) => payload.productVariant,
      }),
      errors: t.field({ type: [BulkStockErrorType], resolve: (payload) => payload.errors }),
    }),
  });

const ProductVariantStocksUpdate = builder
  .objectRef<StocksPayload>("ProductVariantStocksUpdate")
  .implement({
    description: UPDATE_DESCRIPTION,
    fields: (t) => ({
      productVariant: t.field({
        type: ProductVariantType,
        nullable: true,
        description: "Updated product variant.",
        resolve: (payload) => payload.productVariant,
      }),
      errors: t.field({ type: [BulkStockErrorType], resolve: (payload) => payload.errors }),
    }),
  });

const ProductVariantStocksDelete = builder
  .objectRef<StocksDeletePayload>("ProductVariantStocksDelete")
  .implement({
    description: DELETE_DESCRIPTION,
    fields: (t) => ({
      productVariant: t.field({
        type: ProductVariantType,
        nullable: true,
        description: "Updated product variant.",
        resolve: (payload) => payload.productVariant,
      }),
      errors: t.field({ type: [StockErrorType], resolve: (payload) => payload.errors }),
    }),
  });

/** Saleor's `nodesNotFound` message for warehouse ids that match no row. */
const warehousesNotFoundMessage = (ids: string[]) =>
  nodesNotFound(ids.map((id) => toGlobalId("Warehouse", id))).message;

/** A `fromGlobalId` failure as its GraphQLError message; anything else is a bug and rethrows. */
function idErrorMessage(error: unknown): string {
  if (error instanceof GraphQLError) return error.message;
  throw error;
}

/** Stock inputs with their warehouse global IDs decoded (Warehouse primary keys). */
function decodeStockInputs(
  stocks: readonly { warehouse: string; quantity: number }[],
): { ok: true; stocks: StockInputData[] } | { ok: false; message: string } {
  try {
    return {
      ok: true,
      stocks: stocks.map((stock) => ({
        warehouseId: fromGlobalId("Warehouse", String(stock.warehouse)),
        quantity: stock.quantity,
      })),
    };
  } catch (error) {
    return { ok: false, message: idErrorMessage(error) };
  }
}

function decodeWarehouseIds(
  globalIds: readonly string[],
): { ok: true; ids: string[] } | { ok: false; message: string } {
  try {
    return { ok: true, ids: globalIds.map((id) => fromGlobalId("Warehouse", id)) };
  } catch (error) {
    return { ok: false, message: idErrorMessage(error) };
  }
}

/** Saleor's validate_one_of_args_is_in_mutation for `variantId` and `sku`. */
function oneOfArgsError(
  variantId: string | null | undefined,
  sku: string | null | undefined,
): string | null {
  if (variantId != null && sku != null) {
    return "Argument 'sku' cannot be combined with 'variant_id'";
  }
  if (variantId == null && sku == null) {
    return "At least one of arguments is required: 'sku', 'variant_id'.";
  }
  return null;
}

/** Unknown variants are Saleor's top-level node error, as the catalog's variant mutations. */
async function runStockWrite<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId(error.kind, id)));
    }
    throw error;
  }
}

/**
 * The `variantId`/`sku` target of an update or delete: a primary key, or the payload's sku error
 * for a SKU that matches nothing. A `variantId` is resolved by the write (and becomes the
 * top-level node error when unknown).
 */
async function stockMutationVariantId(
  ctx: Context,
  variantId: string | null | undefined,
  sku: string | null | undefined,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (variantId != null) return { ok: true, id: fromGlobalId("ProductVariant", String(variantId)) };
  const variant = await getProductVariant(ctx.db, { sku: String(sku) });
  if (!variant) return { ok: false, message: `Couldn't resolve to a node: ${sku}` };
  return { ok: true, id: variant.id };
}

const stockResultPayload = (
  variantId: string,
  result: VariantStocksResult,
  ctx: Context,
): StocksPayload => {
  if (!result.ok) return { productVariant: null, errors: result.errors };
  ctx.inventoryLoaders.stocksByVariantId.clear(variantId);
  return { productVariant: result.variant, errors: [] };
};

const graphqlError = (field: string | null, message: string): BulkStockErrorData => ({
  field,
  code: "GRAPHQL_ERROR",
  message,
  index: null,
});

/** A `sku` that matches no variant, for the create/update payloads and the delete payload. */
const bulkSkuNotFound = (message: string): BulkStockErrorData => ({
  field: "sku",
  code: "NOT_FOUND",
  message,
  index: null,
});
const stockSkuNotFound = (message: string): StockErrorData => ({
  field: "sku",
  code: "NOT_FOUND",
  message,
});
const stockGraphqlError = (field: string | null, message: string): StockErrorData => ({
  field,
  code: "GRAPHQL_ERROR",
  message,
});

builder.mutationField("productVariantStocksCreate", (t) =>
  t.field({
    type: ProductVariantStocksCreate,
    nullable: true,
    description: CREATE_DESCRIPTION,
    args: {
      variantId: t.arg.id({
        required: true,
        description: "ID of a product variant for which stocks will be created.",
      }),
      stocks: t.arg({
        type: [StockInput],
        required: true,
        description: "Input list of stocks to create.",
      }),
    },
    resolve: async (_parent, { variantId, stocks }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const id = fromGlobalId("ProductVariant", String(variantId));

      const decoded = decodeStockInputs(stocks);
      if (!decoded.ok) {
        return { productVariant: null, errors: [graphqlError("warehouse", decoded.message)] };
      }

      try {
        const result = await runStockWrite(() => createVariantStocks(ctx.db, id, decoded.stocks));
        return stockResultPayload(id, result, ctx);
      } catch (error) {
        if (!(error instanceof WarehouseNotFoundError)) throw error;
        return {
          productVariant: null,
          errors: [graphqlError("warehouse", warehousesNotFoundMessage(error.ids))],
        };
      }
    },
  }),
);

builder.mutationField("productVariantStocksUpdate", (t) =>
  t.field({
    type: ProductVariantStocksUpdate,
    nullable: true,
    description: UPDATE_DESCRIPTION,
    args: {
      variantId: t.arg.id({
        description: "ID of a product variant for which stocks will be updated.",
      }),
      sku: t.arg.string({
        description: "SKU of product variant for which stocks will be updated.",
      }),
      stocks: t.arg({
        type: [StockInput],
        required: true,
        description: "Input list of stocks to create or update.",
      }),
    },
    resolve: async (_parent, { variantId, sku, stocks }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const argsError = oneOfArgsError(variantId, sku);
      if (argsError !== null) {
        return { productVariant: null, errors: [graphqlError(null, argsError)] };
      }

      const variant = await stockMutationVariantId(ctx, variantId, sku);
      if (!variant.ok) {
        return { productVariant: null, errors: [bulkSkuNotFound(variant.message)] };
      }

      const decoded = decodeStockInputs(stocks);
      if (!decoded.ok) {
        return { productVariant: null, errors: [graphqlError("warehouse", decoded.message)] };
      }

      try {
        const result = await runStockWrite(() =>
          updateVariantStocks(ctx.db, variant.id, decoded.stocks),
        );
        return stockResultPayload(variant.id, result, ctx);
      } catch (error) {
        if (!(error instanceof WarehouseNotFoundError)) throw error;
        return {
          productVariant: null,
          errors: [graphqlError("warehouse", warehousesNotFoundMessage(error.ids))],
        };
      }
    },
  }),
);

builder.mutationField("productVariantStocksDelete", (t) =>
  t.field({
    type: ProductVariantStocksDelete,
    nullable: true,
    description: DELETE_DESCRIPTION,
    args: {
      variantId: t.arg.id({
        description: "ID of product variant for which stocks will be deleted.",
      }),
      sku: t.arg.string({
        description: "SKU of product variant for which stocks will be deleted.",
      }),
      warehouseIds: t.arg.idList({ description: "Input list of warehouse IDs." }),
    },
    resolve: async (_parent, { variantId, sku, warehouseIds }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const argsError = oneOfArgsError(variantId, sku);
      if (argsError !== null) {
        return { productVariant: null, errors: [stockGraphqlError(null, argsError)] };
      }

      const variant = await stockMutationVariantId(ctx, variantId, sku);
      if (!variant.ok) {
        return { productVariant: null, errors: [stockSkuNotFound(variant.message)] };
      }

      const decoded = decodeWarehouseIds(warehouseIds ?? []);
      if (!decoded.ok) {
        return {
          productVariant: null,
          errors: [stockGraphqlError("warehouseIds", decoded.message)],
        };
      }

      const result = await runStockWrite(() =>
        deleteVariantStocks(ctx.db, variant.id, decoded.ids),
      );
      ctx.inventoryLoaders.stocksByVariantId.clear(variant.id);
      return { productVariant: result.variant, errors: [] };
    },
  }),
);
