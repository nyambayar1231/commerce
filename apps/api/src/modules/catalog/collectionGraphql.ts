import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { DateTime, JSONString } from "../../graphql/scalars.ts";
import { OrderDirection } from "./graphql.ts";
import {
  addCollectionProducts,
  type CollectionError,
  type CollectionListArgs,
  CollectionNotFoundError,
  type CollectionPage,
  type CollectionProductsResult,
  type CollectionResult,
  type CollectionRow,
  type CollectionSortField,
  createCollection,
  deleteCollection,
  deleteCollections,
  getCollection,
  InvalidCursorError,
  isCollectionPublished,
  listCollections,
  type ProductSortField,
  removeCollectionProducts,
  updateCollection,
} from "./index.ts";
import {
  ProductConnection,
  ProductOrder,
  ProductType,
  ProductWhereInput,
  productConnection,
  seesUnpublished,
  toProductWhere,
} from "./productGraphql.ts";

// Saleor's Collection type, queries and mutations
// (saleor/graphql/product/types/collections.py, saleor/graphql/product/mutations/collection/),
// wired to the catalog module's domain functions.

const RICH_CONTENT = "\n\nRich text format. For reference see https://editorjs.io/";
const PERMISSION = "Requires one of the following permissions: MANAGE_PRODUCTS.";
const UNPUBLISHED_NOTE =
  "Requires one of the following permissions to include the unpublished items: MANAGE_PRODUCTS.";

export const CollectionType = builder.objectRef<CollectionRow>("Collection");

// Saleor's CollectionCountableConnection / CollectionCountableEdge.
const CollectionConnection = builder.connectionObject(
  {
    type: CollectionType,
    name: "CollectionCountableConnection",
    fields: (t) => ({
      totalCount: t.int({
        nullable: true,
        description: "A total count of items in the collection.",
        resolve: (connection) => (connection as unknown as CollectionPage).totalCount,
      }),
    }),
  },
  { name: "CollectionCountableEdge" },
);

// A Relay node (implements Node), as Saleor's Collection.
builder.node(CollectionType, {
  id: { resolve: (collection) => collection.id, description: "The ID of the collection." },
  description: "Represents a collection of products.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "Name of the collection." }),
    slug: t.exposeString("slug", { description: "Slug of the collection." }),
    description: t.field({
      type: JSONString,
      nullable: true,
      description: `Description of the collection.${RICH_CONTENT}`,
      resolve: (collection) => collection.description,
    }),
    isPublished: t.exposeBoolean("isPublished", {
      description: "Informs whether a collection is published.",
    }),
    publishedAt: t.field({
      type: DateTime,
      nullable: true,
      description: "The collection publication date time.",
      resolve: (collection) => collection.publishedAt,
    }),
  }),
});

// Saleor's `Collection.products` (saleor/graphql/product/types/collections.py, resolve_products):
// the products linked to the collection, visible like the `products` query. The manual
// `CollectionProduct.sort_order` is not modelled, so only the product sorts apply.
builder.objectField(CollectionType, "products", (t) =>
  t.connection(
    {
      type: ProductType,
      nullable: true,
      description: `List of products in this collection. ${UNPUBLISHED_NOTE}`,
      args: {
        search: t.arg.string({ description: "Search products." }),
        where: t.arg({
          type: ProductWhereInput,
          description: "Where filtering options for products.",
        }),
        sortBy: t.arg({ type: ProductOrder, description: "Sort products." }),
      },
      resolve: (collection, { search, where, sortBy, ...page }, ctx, info) =>
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
            collectionId: collection.id,
          },
          isEdgesRequested(info),
        ),
    },
    ProductConnection,
  ),
);

// Saleor's `Product.collections` (saleor/graphql/product/types/products.py, resolve_collections):
// the collections the product is in, batched per request. The public sees only the visible ones;
// staff with MANAGE_PRODUCTS see them all.
builder.objectField(ProductType, "collections", (t) =>
  t.field({
    type: [CollectionType],
    nullable: { list: true, items: false },
    description: `List of collections for the product. ${UNPUBLISHED_NOTE}`,
    resolve: async (product, _args, ctx) => {
      const collections = await ctx.loaders.collectionsByProductId.load(product.id);
      if (await seesUnpublished(ctx)) return collections;
      return collections.filter(isCollectionPublished);
    },
  }),
);

/** One page of collections in the connection shape, with Saleor's cursor errors. */
async function collectionConnection(
  db: Parameters<typeof listCollections>[0],
  fieldName: string,
  args: CollectionListArgs,
  edgesRequested: boolean,
) {
  const page = validatePagination(fieldName, args, edgesRequested);
  try {
    const result = await listCollections(db, {
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

// Saleor's CollectionSortField, reduced to the fields we can sort by in one channel.
const CollectionSortFieldEnum = builder.enumType("CollectionSortField", {
  values: {
    NAME: { description: "Sort collections by name." },
    AVAILABILITY: { description: "Sort collections by availability." },
    PRODUCT_COUNT: { description: "Sort collections by product count." },
  } as const,
});

const CollectionSortingInput = builder.inputType("CollectionSortingInput", {
  fields: (t) => ({
    direction: t.field({
      type: OrderDirection,
      required: true,
      description: "Specifies the direction in which to sort collections.",
    }),
    field: t.field({
      type: CollectionSortFieldEnum,
      required: true,
      description: "Sort collections by the selected field.",
    }),
  }),
});

// Saleor's CollectionPublished: only staff may narrow by it, the public always sees the visible
// collections.
const CollectionPublishedEnum = builder.enumType("CollectionPublished", {
  values: ["PUBLISHED", "HIDDEN"] as const,
});

// Saleor's CollectionFilterInput, `search`, `published` and `ids` so far (no metadata or slugs).
const CollectionFilterInput = builder.inputType("CollectionFilterInput", {
  fields: (t) => ({
    published: t.field({ type: CollectionPublishedEnum }),
    search: t.string(),
    ids: t.idList(),
  }),
});

builder.queryField("collections", (t) =>
  t.connection(
    {
      type: CollectionType,
      nullable: true,
      description: `List of the shop's collections. ${UNPUBLISHED_NOTE}`,
      args: {
        filter: t.arg({
          type: CollectionFilterInput,
          description: "Filtering options for collections.",
        }),
        sortBy: t.arg({ type: CollectionSortingInput, description: "Sort collections." }),
      },
      resolve: async (_parent, { filter, sortBy, ...page }, ctx, info) =>
        collectionConnection(
          ctx.db,
          "collections",
          {
            ...page,
            search: filter?.search,
            // Saleor's global IDs decode to primary keys; a malformed or foreign ID is a
            // top-level error, as in Saleor's `from_global_id_or_error`.
            ids: filter?.ids?.map((id) => fromGlobalId("Collection", id)),
            published: filter?.published,
            includeUnpublished: await seesUnpublished(ctx),
            sort: sortBy
              ? { direction: sortBy.direction, field: sortBy.field as CollectionSortField }
              : null,
          },
          isEdgesRequested(info),
        ),
    },
    CollectionConnection,
  ),
);

builder.queryField("collection", (t) =>
  t.field({
    type: CollectionType,
    nullable: true,
    description: `Look up a collection by ID or slug. ${UNPUBLISHED_NOTE}`,
    args: {
      id: t.arg.id({ description: "ID of the collection." }),
      slug: t.arg.string({ description: "Slug of the collection." }),
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
      const collection = hasId
        ? await getCollection(ctx.db, { id: fromGlobalId("Collection", String(id)) })
        : await getCollection(ctx.db, { slug: String(slug) });
      if (!collection) return null;
      if (!(await seesUnpublished(ctx)) && !isCollectionPublished(collection)) return null;
      return collection;
    },
  }),
);

export const CollectionErrorCode = builder.enumType("CollectionErrorCode", {
  values: [
    "DUPLICATED_INPUT_ITEM",
    "GRAPHQL_ERROR",
    "INVALID",
    "NOT_FOUND",
    "REQUIRED",
    "UNIQUE",
  ] as const,
});

const CollectionErrorType = builder.objectRef<CollectionError>("CollectionError").implement({
  description: "Represents an error in the input of a mutation.",
  fields: (t) => ({
    field: t.exposeString("field", {
      nullable: true,
      description:
        "Name of a field that caused the error. A value of `null` indicates that the error " +
        "isn't associated with a particular field.",
    }),
    message: t.exposeString("message", { description: "The error message." }),
    code: t.field({
      type: CollectionErrorCode,
      description: "The error code.",
      resolve: (error) => error.code,
    }),
  }),
});

const CollectionInput = builder.inputType("CollectionInput", {
  fields: (t) => ({
    isPublished: t.boolean({ description: "Informs whether a collection is published." }),
    name: t.string({ description: "Name of the collection." }),
    slug: t.string({ description: "Slug of the collection." }),
    description: t.field({
      type: JSONString,
      description: `Description of the collection.${RICH_CONTENT}`,
    }),
  }),
});

const CollectionCreateInput = builder.inputType("CollectionCreateInput", {
  fields: (t) => ({
    isPublished: t.boolean({ description: "Informs whether a collection is published." }),
    name: t.string({ description: "Name of the collection." }),
    slug: t.string({ description: "Slug of the collection." }),
    description: t.field({
      type: JSONString,
      description: `Description of the collection.${RICH_CONTENT}`,
    }),
    products: t.idList({ description: "List of products to be added to the collection." }),
  }),
});

type CollectionPayload = { collection: CollectionRow | null; errors: CollectionError[] };

const collectionPayloadType = (name: string, description: string, collectionDescription?: string) =>
  builder.objectRef<CollectionPayload>(name).implement({
    description,
    fields: (t) => ({
      collection: t.field({
        type: CollectionType,
        nullable: true,
        description: collectionDescription,
        resolve: (p) => p.collection,
      }),
      errors: t.field({ type: [CollectionErrorType], resolve: (p) => p.errors }),
    }),
  });

const CREATE_DESCRIPTION = `Creates a new collection.\n\n${PERMISSION}`;
const UPDATE_DESCRIPTION = `Updates a collection.\n\n${PERMISSION}`;
const DELETE_DESCRIPTION = `Deletes a collection.\n\n${PERMISSION}`;
const BULK_DELETE_DESCRIPTION = `Deletes collections.\n\n${PERMISSION}`;
const ADD_PRODUCTS_DESCRIPTION = `Adds products to a collection.\n\n${PERMISSION}`;
const REMOVE_PRODUCTS_DESCRIPTION = `Remove products from a collection.\n\n${PERMISSION}`;

const CollectionCreate = collectionPayloadType("CollectionCreate", CREATE_DESCRIPTION);
const CollectionUpdate = collectionPayloadType("CollectionUpdate", UPDATE_DESCRIPTION);
const CollectionDelete = collectionPayloadType("CollectionDelete", DELETE_DESCRIPTION);
const CollectionAddProducts = collectionPayloadType(
  "CollectionAddProducts",
  ADD_PRODUCTS_DESCRIPTION,
  "Collection to which products will be added.",
);
const CollectionRemoveProducts = collectionPayloadType(
  "CollectionRemoveProducts",
  REMOVE_PRODUCTS_DESCRIPTION,
  "Collection from which products will be removed.",
);

/** Maps an unknown collection to Saleor's top-level node error. */
async function runCollection<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof CollectionNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId("Collection", id)));
    }
    throw error;
  }
}

const payload = (result: CollectionResult | CollectionProductsResult): CollectionPayload =>
  result.ok
    ? { collection: result.collection, errors: [] }
    : { collection: null, errors: result.errors };

builder.mutationField("collectionCreate", (t) =>
  t.field({
    type: CollectionCreate,
    description: CREATE_DESCRIPTION,
    args: {
      input: t.arg({
        type: CollectionCreateInput,
        required: true,
        description: "Fields required to create a collection.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await createCollection(ctx.db, {
        name: input.name ?? "",
        slug: input.slug ?? undefined,
        description: input.description,
        isPublished: input.isPublished ?? undefined,
        products: input.products?.map((id) => fromGlobalId("Product", id)),
      });
      return payload(result);
    },
  }),
);

builder.mutationField("collectionUpdate", (t) =>
  t.field({
    type: CollectionUpdate,
    description: UPDATE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a collection to update." }),
      input: t.arg({
        type: CollectionInput,
        required: true,
        description: "Fields required to update a collection.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runCollection(() =>
        updateCollection(ctx.db, fromGlobalId("Collection", String(id)), {
          name: input.name ?? undefined,
          slug: input.slug ?? undefined,
          description: input.description,
          isPublished: input.isPublished ?? undefined,
        }),
      );
      return payload(result);
    },
  }),
);

builder.mutationField("collectionDelete", (t) =>
  t.field({
    type: CollectionDelete,
    description: DELETE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a collection to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const collection = await runCollection(() =>
        deleteCollection(ctx.db, fromGlobalId("Collection", String(id))),
      );
      return { collection, errors: [] };
    },
  }),
);

type CollectionBulkDeletePayload = { count: number; errors: CollectionError[] };

const CollectionBulkDelete = builder
  .objectRef<CollectionBulkDeletePayload>("CollectionBulkDelete")
  .implement({
    description: BULK_DELETE_DESCRIPTION,
    fields: (t) => ({
      count: t.exposeInt("count", { description: "Returns how many objects were affected." }),
      errors: t.field({ type: [CollectionErrorType], resolve: (p) => p.errors }),
    }),
  });

builder.mutationField("collectionBulkDelete", (t) =>
  t.field({
    type: CollectionBulkDelete,
    nullable: true,
    description: BULK_DELETE_DESCRIPTION,
    args: {
      ids: t.arg.idList({ required: true, description: "List of collection IDs to delete." }),
    },
    resolve: async (_parent, { ids }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const collectionIds = ids.map((id) => fromGlobalId("Collection", String(id)));
      const { count } = await runCollection(() => deleteCollections(ctx.db, collectionIds));

      return { count, errors: [] };
    },
  }),
);

builder.mutationField("collectionAddProducts", (t) =>
  t.field({
    type: CollectionAddProducts,
    description: ADD_PRODUCTS_DESCRIPTION,
    args: {
      collectionId: t.arg.id({ required: true, description: "ID of a collection." }),
      products: t.arg.idList({ required: true, description: "List of product IDs." }),
    },
    resolve: async (_parent, { collectionId, products }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await addCollectionProducts(
        ctx.db,
        fromGlobalId("Collection", String(collectionId)),
        products.map((id) => fromGlobalId("Product", String(id))),
      );
      return payload(result);
    },
  }),
);

builder.mutationField("collectionRemoveProducts", (t) =>
  t.field({
    type: CollectionRemoveProducts,
    description: REMOVE_PRODUCTS_DESCRIPTION,
    args: {
      collectionId: t.arg.id({ required: true, description: "ID of a collection." }),
      products: t.arg.idList({ required: true, description: "List of product IDs." }),
    },
    resolve: async (_parent, { collectionId, products }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await removeCollectionProducts(
        ctx.db,
        fromGlobalId("Collection", String(collectionId)),
        products.map((id) => fromGlobalId("Product", String(id))),
      );
      return payload(result);
    },
  }),
);
