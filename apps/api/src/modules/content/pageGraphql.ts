import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { DateTime, JSONString } from "../../graphql/scalars.ts";
import { OrderDirection } from "../catalog/graphql.ts";
import { InvalidCursorError } from "../catalog/index.ts";
import {
  createPage,
  deletePage,
  deletePages,
  getPage,
  isPagePublished,
  listPages,
  type PageError,
  type PageListArgs,
  PageNotFoundError,
  type PagePage,
  type PageResult,
  type PageRow,
  type PageSortField,
  updatePage,
} from "./index.ts";

// Saleor's Page type, queries and mutations (saleor/graphql/page/types.py,
// saleor/graphql/page/schema.py, saleor/graphql/page/mutations/), wired to the content module's
// domain functions. Page types and attributes are not modelled (ARCHITECTURE.md §4 deviations).

const RICH_CONTENT = "\n\nRich text format. For reference see https://editorjs.io/";
const PERMISSION = "Requires one of the following permissions: MANAGE_PAGES.";
const UNPUBLISHED_NOTE =
  "Requires one of the following permissions to include the unpublished items: MANAGE_PAGES.";

/** Staff with MANAGE_PAGES see unpublished and future-dated pages too. */
async function seesUnpublished(ctx: Context): Promise<boolean> {
  return Boolean(ctx.user?.isStaff) && (await ctx.permissions()).includes("MANAGE_PAGES");
}

export const PageType = builder.objectRef<PageRow>("Page");

// Saleor's PageCountableConnection / PageCountableEdge.
const PageConnection = builder.connectionObject(
  {
    type: PageType,
    name: "PageCountableConnection",
    fields: (t) => ({
      totalCount: t.int({
        nullable: true,
        description: "A total count of items in the collection.",
        resolve: (connection) => (connection as unknown as PagePage).totalCount,
      }),
    }),
  },
  { name: "PageCountableEdge" },
);

// A Relay node (implements Node), as Saleor's Page.
builder.node(PageType, {
  id: { resolve: (page) => page.id, description: "ID of the page." },
  description: "A static page that can be manually added by a shop operator through the dashboard.",
  fields: (t) => ({
    title: t.exposeString("title", { description: "Title of the page." }),
    slug: t.exposeString("slug", { description: "Slug of the page." }),
    content: t.field({
      type: JSONString,
      nullable: true,
      description: `Content of the page.${RICH_CONTENT}`,
      resolve: (page) => page.content,
    }),
    isPublished: t.exposeBoolean("isPublished", {
      description: "Determines if the page is published.",
    }),
    publishedAt: t.field({
      type: DateTime,
      nullable: true,
      description: "The page publication date.",
      resolve: (page) => page.publishedAt,
    }),
    created: t.field({
      type: DateTime,
      description: "Date and time at which page was created.",
      resolve: (page) => page.createdAt,
    }),
  }),
});

/** One page of pages in the connection shape, with Saleor's cursor errors. */
async function pageConnection(
  db: Parameters<typeof listPages>[0],
  fieldName: string,
  args: PageListArgs,
  edgesRequested: boolean,
) {
  const page = validatePagination(fieldName, args, edgesRequested);
  try {
    const result = await listPages(db, {
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

// Saleor's PageSortField, reduced to the fields we can sort by in one channel.
const PageSortFieldEnum = builder.enumType("PageSortField", {
  values: {
    TITLE: { description: "Sort pages by title." },
    SLUG: { description: "Sort pages by slug." },
    VISIBILITY: { description: "Sort pages by visibility." },
    CREATION_DATE: { description: "Sort pages by creation date." },
    PUBLICATION_DATE: { description: "Sort pages by publication date." },
  } as const,
});

const PageSortingInput = builder.inputType("PageSortingInput", {
  fields: (t) => ({
    direction: t.field({
      type: OrderDirection,
      required: true,
      description: "Specifies the direction in which to sort pages.",
    }),
    field: t.field({
      type: PageSortFieldEnum,
      required: true,
      description: "Sort pages by the selected field.",
    }),
  }),
});

// Saleor's PageFilterInput, `search` and `ids` so far (no page types, slugs or metadata).
const PageFilterInput = builder.inputType("PageFilterInput", {
  fields: (t) => ({
    search: t.string(),
    ids: t.idList(),
  }),
});

builder.queryField("pages", (t) =>
  t.connection(
    {
      type: PageType,
      nullable: true,
      description: `List of the shop's pages. ${UNPUBLISHED_NOTE}`,
      args: {
        filter: t.arg({
          type: PageFilterInput,
          description: "Filtering options for pages.",
        }),
        sortBy: t.arg({ type: PageSortingInput, description: "Sort pages." }),
      },
      resolve: async (_parent, { filter, sortBy, ...page }, ctx, info) =>
        pageConnection(
          ctx.db,
          "pages",
          {
            ...page,
            search: filter?.search,
            // Saleor's global IDs decode to primary keys; a malformed or foreign ID is a
            // top-level error, as in Saleor's `from_global_id_or_error`.
            ids: filter?.ids?.map((id) => fromGlobalId("Page", id)),
            includeUnpublished: await seesUnpublished(ctx),
            sort: sortBy
              ? { direction: sortBy.direction, field: sortBy.field as PageSortField }
              : null,
          },
          isEdgesRequested(info),
        ),
    },
    PageConnection,
  ),
);

builder.queryField("page", (t) =>
  t.field({
    type: PageType,
    nullable: true,
    description: `Look up a page by ID or slug. ${UNPUBLISHED_NOTE}`,
    args: {
      id: t.arg.id({ description: "ID of the page." }),
      slug: t.arg.string({ description: "The slug of the page." }),
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
      const page = hasId
        ? await getPage(ctx.db, { id: fromGlobalId("Page", String(id)) })
        : await getPage(ctx.db, { slug: String(slug) });
      if (!page) return null;
      if (!(await seesUnpublished(ctx)) && !isPagePublished(page)) return null;
      return page;
    },
  }),
);

export const PageErrorCode = builder.enumType("PageErrorCode", {
  values: ["GRAPHQL_ERROR", "INVALID", "NOT_FOUND", "REQUIRED", "UNIQUE"] as const,
});

const PageErrorType = builder.objectRef<PageError>("PageError").implement({
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
      type: PageErrorCode,
      description: "The error code.",
      resolve: (error) => error.code,
    }),
  }),
});

const PageInput = builder.inputType("PageInput", {
  fields: (t) => ({
    slug: t.string({ description: "Page internal name." }),
    title: t.string({ description: "Page title." }),
    content: t.field({
      type: JSONString,
      description: `Page content.${RICH_CONTENT}`,
    }),
    isPublished: t.boolean({
      description: "Determines if page is visible in the storefront.",
    }),
  }),
});

const PageCreateInput = builder.inputType("PageCreateInput", {
  fields: (t) => ({
    slug: t.string({ description: "Page internal name." }),
    title: t.string({ description: "Page title." }),
    content: t.field({
      type: JSONString,
      description: `Page content.${RICH_CONTENT}`,
    }),
    isPublished: t.boolean({
      description: "Determines if page is visible in the storefront.",
    }),
  }),
});

type PagePayload = { page: PageRow | null; errors: PageError[] };

const pagePayloadType = (name: string, description: string, pageDescription?: string) =>
  builder.objectRef<PagePayload>(name).implement({
    description,
    fields: (t) => ({
      page: t.field({
        type: PageType,
        nullable: true,
        description: pageDescription,
        resolve: (p) => p.page,
      }),
      errors: t.field({ type: [PageErrorType], resolve: (p) => p.errors }),
    }),
  });

const CREATE_DESCRIPTION = `Creates a new page.\n\n${PERMISSION}`;
const UPDATE_DESCRIPTION = `Updates an existing page.\n\n${PERMISSION}`;
const DELETE_DESCRIPTION = `Deletes a page.\n\n${PERMISSION}`;
const BULK_DELETE_DESCRIPTION = `Deletes pages.\n\n${PERMISSION}`;

const PageCreate = pagePayloadType("PageCreate", CREATE_DESCRIPTION);
const PageUpdate = pagePayloadType("PageUpdate", UPDATE_DESCRIPTION);
const PageDelete = pagePayloadType("PageDelete", DELETE_DESCRIPTION);

/** Maps an unknown page to Saleor's top-level node error. */
async function runPage<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof PageNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId("Page", id)));
    }
    throw error;
  }
}

const payload = (result: PageResult): PagePayload =>
  result.ok ? { page: result.page, errors: [] } : { page: null, errors: result.errors };

builder.mutationField("pageCreate", (t) =>
  t.field({
    type: PageCreate,
    description: CREATE_DESCRIPTION,
    args: {
      input: t.arg({
        type: PageCreateInput,
        required: true,
        description: "Fields required to create a page.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PAGES");
      return payload(
        await createPage(ctx.db, {
          title: input.title ?? "",
          slug: input.slug ?? undefined,
          content: input.content,
          isPublished: input.isPublished ?? undefined,
        }),
      );
    },
  }),
);

builder.mutationField("pageUpdate", (t) =>
  t.field({
    type: PageUpdate,
    description: UPDATE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a page to update." }),
      input: t.arg({
        type: PageInput,
        required: true,
        description: "Fields required to update a page.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_PAGES");
      return payload(
        await runPage(() =>
          updatePage(ctx.db, fromGlobalId("Page", String(id)), {
            title: input.title ?? undefined,
            slug: input.slug ?? undefined,
            content: input.content,
            isPublished: input.isPublished ?? undefined,
          }),
        ),
      );
    },
  }),
);

builder.mutationField("pageDelete", (t) =>
  t.field({
    type: PageDelete,
    description: DELETE_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a page to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_PAGES");
      const page = await runPage(() => deletePage(ctx.db, fromGlobalId("Page", String(id))));
      return { page, errors: [] };
    },
  }),
);

type PageBulkDeletePayload = { count: number; errors: PageError[] };

const PageBulkDelete = builder.objectRef<PageBulkDeletePayload>("PageBulkDelete").implement({
  description: BULK_DELETE_DESCRIPTION,
  fields: (t) => ({
    count: t.exposeInt("count", { description: "Returns how many objects were affected." }),
    errors: t.field({ type: [PageErrorType], resolve: (p) => p.errors }),
  }),
});

builder.mutationField("pageBulkDelete", (t) =>
  t.field({
    type: PageBulkDelete,
    nullable: true,
    description: BULK_DELETE_DESCRIPTION,
    args: {
      ids: t.arg.idList({ required: true, description: "List of page IDs to delete." }),
    },
    resolve: async (_parent, { ids }, ctx) => {
      await requirePermission(ctx, "MANAGE_PAGES");
      const pageIds = ids.map((id) => fromGlobalId("Page", String(id)));
      const { count } = await runPage(() => deletePages(ctx.db, pageIds));
      return { count, errors: [] };
    },
  }),
);
