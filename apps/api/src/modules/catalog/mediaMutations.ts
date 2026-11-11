import { builder } from "../../graphql/builder.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { Upload } from "../../graphql/scalars.ts";
import { getStorage } from "../../storage/index.ts";
import { ProductErrorType } from "./graphql.ts";
import {
  createProductMedia,
  deleteProductMedia,
  type ProductMediaError,
  ProductMediaNotFoundError,
  type ProductMediaRow,
  ProductNotFoundError,
  type ProductRow,
  reorderProductMedia,
  updateProductMedia,
} from "./index.ts";
import { ProductMediaType, ProductType } from "./productGraphql.ts";

// Saleor's productMediaCreate/Update/Delete/Reorder (saleor/graphql/product/mutations/product/),
// wired to the catalog module's media domain functions.

const PERMISSION = "Requires one of the following permissions: MANAGE_PRODUCTS.";

type ProductMediaPayload = {
  product: ProductRow | null;
  media: ProductMediaRow | null;
  errors: ProductMediaError[];
};

type ProductMediaListPayload = {
  product: ProductRow | null;
  media: ProductMediaRow[];
  errors: ProductMediaError[];
};

const ProductMediaCreateInput = builder.inputType("ProductMediaCreateInput", {
  description: "Fields required to create a product media.",
  fields: (t) => ({
    alt: t.string({ description: "Alt text for a product media." }),
    image: t.field({
      type: Upload,
      description: "Represents an image file in a multipart request.",
    }),
    product: t.id({ required: true, description: "ID of an product." }),
  }),
});

const ProductMediaUpdateInput = builder.inputType("ProductMediaUpdateInput", {
  description: "Fields required to update a product media.",
  fields: (t) => ({
    alt: t.string({ description: "Alt text for a product media." }),
  }),
});

const CREATE_DESCRIPTION =
  "Create a media object (image or video URL) associated with product. For image, this " +
  "mutation must be sent as a `multipart` request. More detailed specs of the upload format can " +
  "be found here: https://github.com/jaydenseric/graphql-multipart-request-spec\n\n" +
  PERMISSION;
const UPDATE_DESCRIPTION = `Updates a product media.\n\n${PERMISSION}`;
const DELETE_DESCRIPTION = `Deletes a product media.\n\n${PERMISSION}`;
const REORDER_DESCRIPTION = `Changes ordering of the product media.\n\n${PERMISSION}`;

const ProductMediaCreate = builder.objectRef<ProductMediaPayload>("ProductMediaCreate").implement({
  description: CREATE_DESCRIPTION,
  fields: (t) => ({
    product: t.field({ type: ProductType, nullable: true, resolve: (p) => p.product }),
    media: t.field({ type: ProductMediaType, nullable: true, resolve: (p) => p.media }),
    errors: t.field({ type: [ProductErrorType], resolve: (p) => p.errors }),
  }),
});

const ProductMediaUpdate = builder.objectRef<ProductMediaPayload>("ProductMediaUpdate").implement({
  description: UPDATE_DESCRIPTION,
  fields: (t) => ({
    product: t.field({ type: ProductType, nullable: true, resolve: (p) => p.product }),
    media: t.field({ type: ProductMediaType, nullable: true, resolve: (p) => p.media }),
    errors: t.field({ type: [ProductErrorType], resolve: (p) => p.errors }),
  }),
});

const ProductMediaDelete = builder.objectRef<ProductMediaPayload>("ProductMediaDelete").implement({
  description: DELETE_DESCRIPTION,
  fields: (t) => ({
    product: t.field({ type: ProductType, nullable: true, resolve: (p) => p.product }),
    media: t.field({ type: ProductMediaType, nullable: true, resolve: (p) => p.media }),
    errors: t.field({ type: [ProductErrorType], resolve: (p) => p.errors }),
  }),
});

const ProductMediaReorder = builder
  .objectRef<ProductMediaListPayload>("ProductMediaReorder")
  .implement({
    description: REORDER_DESCRIPTION,
    fields: (t) => ({
      product: t.field({ type: ProductType, nullable: true, resolve: (p) => p.product }),
      media: t.field({ type: [ProductMediaType], resolve: (p) => p.media }),
      errors: t.field({ type: [ProductErrorType], resolve: (p) => p.errors }),
    }),
  });

/** Maps an unknown product or media id to Saleor's top-level node error, as the product mutations. */
async function runMedia<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId(error.kind, id)));
    }
    if (error instanceof ProductMediaNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId("ProductMedia", id)));
    }
    throw error;
  }
}

builder.mutationField("productMediaCreate", (t) =>
  t.field({
    type: ProductMediaCreate,
    description: CREATE_DESCRIPTION,
    args: {
      input: t.arg({
        type: ProductMediaCreateInput,
        required: true,
        description: "Fields required to create a product media.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runMedia(() =>
        createProductMedia(ctx.db, getStorage(), {
          productId: fromGlobalId("Product", String(input.product)),
          alt: input.alt,
          file: input.image ?? null,
        }),
      );
      return result.ok
        ? { product: result.product, media: result.media, errors: [] }
        : { product: null, media: null, errors: result.errors };
    },
  }),
);

builder.mutationField("productMediaUpdate", (t) =>
  t.field({
    type: ProductMediaUpdate,
    description: UPDATE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a product media to update." }),
      input: t.arg({
        type: ProductMediaUpdateInput,
        required: true,
        description: "Fields required to update a product media.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runMedia(() =>
        updateProductMedia(ctx.db, fromGlobalId("ProductMedia", String(id)), { alt: input.alt }),
      );
      return result.ok
        ? { product: result.product, media: result.media, errors: [] }
        : { product: null, media: null, errors: result.errors };
    },
  }),
);

builder.mutationField("productMediaDelete", (t) =>
  t.field({
    type: ProductMediaDelete,
    description: DELETE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a product media to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const { product, media } = await runMedia(() =>
        deleteProductMedia(ctx.db, getStorage(), fromGlobalId("ProductMedia", String(id))),
      );
      return { product, media, errors: [] };
    },
  }),
);

builder.mutationField("productMediaReorder", (t) =>
  t.field({
    type: ProductMediaReorder,
    description: REORDER_DESCRIPTION,
    args: {
      productId: t.arg.id({
        required: true,
        description: "ID of product that media order will be altered.",
      }),
      mediaIds: t.arg.idList({
        required: true,
        description: "IDs of a product media in the desired order.",
      }),
    },
    resolve: async (_parent, { productId, mediaIds }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runMedia(() =>
        reorderProductMedia(
          ctx.db,
          fromGlobalId("Product", String(productId)),
          mediaIds.map((id) => fromGlobalId("ProductMedia", String(id))),
        ),
      );
      return result.ok
        ? { product: result.product, media: result.media, errors: [] }
        : { product: null, media: [], errors: result.errors };
    },
  }),
);
