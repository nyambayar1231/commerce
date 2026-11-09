import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { DateTime, JSONString } from "../../graphql/scalars.ts";
import {
  type CategoryError,
  type CategoryResult,
  type CategoryRow,
  createCategory,
  deleteCategory,
  getCategory,
  getCategoryLevel,
  NotFoundError,
  updateCategory,
} from "./index.ts";

const RICH_CONTENT = "\n\nRich text format. For reference see https://editorjs.io/";
const PERMISSION = "Requires one of the following permissions: MANAGE_PRODUCTS.";

type CategoryModel = CategoryRow & { level?: number };

const CategoryType = builder.objectRef<CategoryModel>("Category");

// A Relay node (implements Node), as Saleor's Category.
builder.node(CategoryType, {
  id: { resolve: (category) => category.id, description: "The ID of the category." },
  description:
    "Represents a single category of products. Categories allow to organize products in a " +
    "tree-hierarchies which can be used for navigation in the storefront.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "Name of category" }),
    slug: t.exposeString("slug", { description: "Slug of the category." }),
    description: t.field({
      type: JSONString,
      nullable: true,
      description: `Description of the category.${RICH_CONTENT}`,
      resolve: (category) => category.description,
    }),
    parent: t.field({
      type: CategoryType,
      nullable: true,
      description: "Parent category.",
      resolve: (category, _args, ctx) =>
        category.parentId === null ? null : getCategory(ctx.db, { id: category.parentId }),
    }),
    level: t.int({
      description: "Level of the category.",
      resolve: (category, _args, ctx) => category.level ?? getCategoryLevel(ctx.db, category.id),
    }),
    updatedAt: t.field({
      type: DateTime,
      description: "The date and time when the category was last updated.",
      resolve: (category) => category.updatedAt,
    }),
  }),
});

const ProductErrorCode = builder.enumType("ProductErrorCode", {
  values: ["GRAPHQL_ERROR", "INVALID", "NOT_FOUND", "REQUIRED", "UNIQUE"] as const,
});

const ProductErrorType = builder.objectRef<CategoryError>("ProductError").implement({
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
      type: ProductErrorCode,
      description: "The error code.",
      resolve: (error) => error.code,
    }),
  }),
});

const CategoryInput = builder.inputType("CategoryInput", {
  fields: (t) => ({
    description: t.field({
      type: JSONString,
      description: `Category description.${RICH_CONTENT}`,
    }),
    name: t.string({ description: "Category name." }),
    slug: t.string({ description: "Category slug." }),
  }),
});

type CategoryPayload = { category: CategoryModel | null; errors: CategoryError[] };

const categoryPayload = (name: string, description: string) =>
  builder.objectRef<CategoryPayload>(name).implement({
    description,
    fields: (t) => ({
      category: t.field({ type: CategoryType, nullable: true, resolve: (p) => p.category }),
      errors: t.field({ type: [ProductErrorType], resolve: (p) => p.errors }),
    }),
  });

const CREATE_DESCRIPTION = `Creates a new category.\n\n${PERMISSION}`;
const UPDATE_DESCRIPTION = `Updates a category.\n\n${PERMISSION}`;
const DELETE_DESCRIPTION = `Deletes a category.\n\n${PERMISSION}`;

const CategoryCreateType = categoryPayload("CategoryCreate", CREATE_DESCRIPTION);
const CategoryUpdateType = categoryPayload("CategoryUpdate", UPDATE_DESCRIPTION);
const CategoryDeleteType = categoryPayload("CategoryDelete", DELETE_DESCRIPTION);

builder.queryField("category", (t) =>
  t.field({
    type: CategoryType,
    nullable: true,
    description: "Look up a category by ID or slug.",
    args: {
      id: t.arg.id({ description: "ID of the category." }),
      slug: t.arg.string({ description: "Slug of the category" }),
    },
    resolve: (_parent, { id, slug }, ctx) => {
      const hasId = Boolean(id);
      const hasSlug = Boolean(slug);
      if (hasId && hasSlug) {
        throw new GraphQLError("Argument 'id' cannot be combined with 'slug'");
      }
      if (!hasId && !hasSlug) {
        throw new GraphQLError("At least one of arguments is required: 'id', 'slug'.");
      }
      return hasId
        ? getCategory(ctx.db, { id: fromGlobalId("Category", String(id)) })
        : getCategory(ctx.db, { slug: String(slug) });
    },
  }),
);

/** Maps an unknown category or parent to Saleor's top-level node error. */
async function runCategory<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId("Category", id)));
    }
    throw error;
  }
}

const payload = (result: CategoryResult): CategoryPayload =>
  result.ok ? { category: result.category, errors: [] } : { category: null, errors: result.errors };

builder.mutationField("categoryCreate", (t) =>
  t.field({
    type: CategoryCreateType,
    description: CREATE_DESCRIPTION,
    args: {
      input: t.arg({
        type: CategoryInput,
        required: true,
        description: "Fields required to create a category.",
      }),
      parent: t.arg.id({
        description: "ID of the parent category. If empty, category will be top level category.",
      }),
    },
    resolve: async (_parent, { input, parent }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const result = await runCategory(() =>
        createCategory(ctx.db, {
          name: input.name ?? "",
          slug: input.slug ?? undefined,
          description: input.description,
          parentId: parent == null ? undefined : fromGlobalId("Category", String(parent)),
        }),
      );
      return payload(result);
    },
  }),
);

builder.mutationField("categoryUpdate", (t) =>
  t.field({
    type: CategoryUpdateType,
    description: UPDATE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a category to update." }),
      input: t.arg({
        type: CategoryInput,
        required: true,
        description: "Fields required to update a category.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const categoryId = fromGlobalId("Category", String(id));
      const result = await runCategory(() =>
        updateCategory(ctx.db, categoryId, {
          name: input.name ?? undefined,
          slug: input.slug ?? undefined,
          description: input.description,
        }),
      );
      return payload(result);
    },
  }),
);

builder.mutationField("categoryDelete", (t) =>
  t.field({
    type: CategoryDeleteType,
    description: DELETE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a category to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_PRODUCTS");
      const globalId = String(id);
      const categoryId = fromGlobalId("Category", globalId);
      return runCategory(async () => {
        const category = await getCategory(ctx.db, { id: categoryId });
        if (!category) throw new NotFoundError([categoryId]);
        // The row is gone when subfields resolve, so retain its pre-delete depth.
        const level = await getCategoryLevel(ctx.db, categoryId);
        await deleteCategory(ctx.db, categoryId);
        return { category: { ...category, level }, errors: [] };
      });
    },
  }),
);
