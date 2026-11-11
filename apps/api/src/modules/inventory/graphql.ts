import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId } from "../../graphql/globalId.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { requirePermission } from "../../graphql/permissions.ts";
// GraphQL layer: the object ref is imported from catalog's GraphQL file, not its index.ts
// (ARCHITECTURE §2 rule 2).
import { ProductVariantType } from "../catalog/productGraphql.ts";
import {
  availableQuantity,
  getWarehouse,
  InvalidCursorError,
  listWarehouses,
  type StockRow,
  type WarehouseListArgs,
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
