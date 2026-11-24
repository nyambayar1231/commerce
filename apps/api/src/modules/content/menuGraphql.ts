import { schema } from "@commerce/db";
import DataLoader from "dataloader";
import { asc, inArray } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { decodeGlobalId, fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { CollectionType } from "../catalog/collectionGraphql.ts";
import { CategoryType, OrderDirection } from "../catalog/graphql.ts";
import { type CollectionRow, InvalidCursorError, isCollectionPublished } from "../catalog/index.ts";
import {
  createMenu,
  createMenuItem,
  deleteMenu,
  deleteMenuItem,
  deleteMenuItems,
  deleteMenus,
  getMenu,
  getMenuItem,
  isPagePublished,
  listMenus,
  type MenuCreateInput,
  type MenuError,
  type MenuItemCreateInput,
  type MenuItemInput,
  type MenuItemMove as MenuItemMoveOperation,
  type MenuItemNode,
  MenuItemNotFoundError,
  type MenuItemResult,
  type MenuItemRow,
  type MenuItemUpdateInput,
  type MenuListArgs,
  MenuNotFoundError,
  type MenuPage,
  type MenuResult,
  type MenuRow,
  type MenuSortField,
  type MenuUpdateInput,
  moveMenuItems,
  type PageRow,
  updateMenu,
  updateMenuItem,
  withLevels,
} from "./index.ts";
import { PageType } from "./pageGraphql.ts";

// Saleor's Menu and MenuItem types, queries and mutations
// (saleor/graphql/menu/types.py, schema.py, mutations/), wired to the content module's domain
// functions.

const PERMISSION = "Requires one of the following permissions: MANAGE_MENUS.";
const MENU_ITEM_DESCRIPTION =
  "Represents a single item of the related menu. Can store categories, collection or pages.";
const UNPUBLISHED_COLLECTION_NOTE =
  "Requires one of the following permissions to include the unpublished items: MANAGE_PRODUCTS.";
const UNPUBLISHED_PAGE_NOTE =
  "Requires one of the following permissions to include the unpublished items: MANAGE_PAGES.";

interface MenuLoaders {
  menuById: DataLoader<string, MenuRow | null>;
  menuItemsByMenuId: DataLoader<string, MenuItemNode[]>;
  collectionById: DataLoader<string, CollectionRow | null>;
  pageById: DataLoader<string, PageRow | null>;
}

// The context is created per request, so a WeakMap gives one set of loaders per request without
// extending the shared Context type (the menus are the only fields that need them).
const loadersByContext = new WeakMap<Context, MenuLoaders>();

function menuLoaders(ctx: Context): MenuLoaders {
  let loaders = loadersByContext.get(ctx);
  if (loaders) return loaders;

  const db = ctx.db;
  loaders = {
    menuById: new DataLoader(async (ids) => {
      const rows = await db
        .select()
        .from(schema.menu)
        .where(inArray(schema.menu.id, [...ids]));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? null);
    }),

    menuItemsByMenuId: new DataLoader(async (menuIds) => {
      const rows = await db
        .select()
        .from(schema.menuItem)
        .where(inArray(schema.menuItem.menuId, [...menuIds]))
        .orderBy(asc(schema.menuItem.sortOrder), asc(schema.menuItem.id));
      const byMenu = new Map<string, MenuItemRow[]>();
      for (const row of rows) {
        const items = byMenu.get(row.menuId);
        if (items) items.push(row);
        else byMenu.set(row.menuId, [row]);
      }
      return menuIds.map((menuId) => withLevels(byMenu.get(menuId) ?? []));
    }),

    collectionById: new DataLoader(async (ids) => {
      const rows = await db
        .select()
        .from(schema.collection)
        .where(inArray(schema.collection.id, [...ids]));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? null);
    }),

    pageById: new DataLoader(async (ids) => {
      const rows = await db
        .select()
        .from(schema.page)
        .where(inArray(schema.page.id, [...ids]));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? null);
    }),
  };
  loadersByContext.set(ctx, loaders);
  return loaders;
}

async function seesPermission(ctx: Context, permission: "MANAGE_PRODUCTS" | "MANAGE_PAGES") {
  return Boolean(ctx.user?.isStaff) && (await ctx.permissions()).includes(permission);
}

// The refs come first so Menu and MenuItem can refer to each other.
const MenuType = builder.objectRef<MenuRow>("Menu");
const MenuItemType = builder.objectRef<MenuItemRow>("MenuItem");

builder.node(MenuItemType, {
  id: { resolve: (menuItem) => menuItem.id, description: "The ID of the menu item." },
  description: MENU_ITEM_DESCRIPTION,
  fields: (t) => ({
    name: t.exposeString("name", { description: "The name of the menu item." }),
    menu: t.field({
      type: MenuType,
      description: "Represents the menu to which the menu item belongs.",
      resolve: async (menuItem, _args, ctx) => {
        const menu = await menuLoaders(ctx).menuById.load(menuItem.menuId);
        if (!menu) throw new Error(`Menu item ${menuItem.id} has no menu.`);
        return menu;
      },
    }),
    parent: t.field({
      type: MenuItemType,
      nullable: true,
      description: "ID of parent menu item. If empty, menu will be top level menu.",
      resolve: async (menuItem, _args, ctx) => {
        if (!menuItem.parentId) return null;
        const items = await menuLoaders(ctx).menuItemsByMenuId.load(menuItem.menuId);
        return items.find((item) => item.id === menuItem.parentId) ?? null;
      },
    }),
    children: t.field({
      type: [MenuItemType],
      description: "Represents the child items of the current menu item.",
      resolve: async (menuItem, _args, ctx) => {
        const items = await menuLoaders(ctx).menuItemsByMenuId.load(menuItem.menuId);
        return items.filter((item) => item.parentId === menuItem.id);
      },
    }),
    level: t.int({
      description: "Indicates the position of the menu item within the menu structure.",
      resolve: (menuItem) => (menuItem as MenuItemRow & { level?: number }).level ?? 0,
    }),
    url: t.exposeString("url", { nullable: true, description: "URL to the menu item." }),
    category: t.field({
      type: CategoryType,
      nullable: true,
      description: "Category associated with the menu item.",
      resolve: async (menuItem, _args, ctx) => {
        if (!menuItem.categoryId) return null;
        return ctx.loaders.categoryById.load(menuItem.categoryId);
      },
    }),
    collection: t.field({
      type: CollectionType,
      nullable: true,
      description: `A collection associated with this menu item. ${UNPUBLISHED_COLLECTION_NOTE}`,
      resolve: async (menuItem, _args, ctx) => {
        if (!menuItem.collectionId) return null;
        const collection = await menuLoaders(ctx).collectionById.load(menuItem.collectionId);
        if (!collection) return null;
        if (await seesPermission(ctx, "MANAGE_PRODUCTS")) return collection;
        return isCollectionPublished(collection) ? collection : null;
      },
    }),
    page: t.field({
      type: PageType,
      nullable: true,
      description: `A page associated with this menu item. ${UNPUBLISHED_PAGE_NOTE}`,
      resolve: async (menuItem, _args, ctx) => {
        if (!menuItem.pageId) return null;
        const page = await menuLoaders(ctx).pageById.load(menuItem.pageId);
        if (!page) return null;
        if (await seesPermission(ctx, "MANAGE_PAGES")) return page;
        return isPagePublished(page) ? page : null;
      },
    }),
  }),
});

builder.node(MenuType, {
  id: { resolve: (menu) => menu.id, description: "The ID of the menu." },
  description:
    "Represents a single menu - an object that is used to help navigate through the store.",
  fields: (t) => ({
    name: t.exposeString("name", { description: "The name of the menu." }),
    slug: t.exposeString("slug", { description: "Slug of the menu." }),
    items: t.field({
      type: [MenuItemType],
      description: "Menu items associated with this menu.",
      resolve: async (menu, _args, ctx) => {
        const items = await menuLoaders(ctx).menuItemsByMenuId.load(menu.id);
        return items.filter((item) => item.parentId === null);
      },
    }),
  }),
});

builder.queryField("menu", (t) =>
  t.field({
    type: MenuType,
    nullable: true,
    description: "Look up a navigation menu by ID or name.",
    args: {
      id: t.arg.id({ description: "ID of the menu." }),
      name: t.arg.string({ description: "The menu's name." }),
      slug: t.arg.string({ description: "The menu's slug." }),
    },
    resolve: async (_parent, { id, name, slug }, ctx) => {
      const present = (
        [
          ["id", id],
          ["name", name],
          ["slug", slug],
        ] as const
      ).filter(([, value]) => Boolean(value));
      if (present.length > 1) {
        const rest = present
          .slice(1)
          .map(([key]) => `'${key}'`)
          .join(", ");
        throw new GraphQLError(`Argument '${present[0]?.[0]}' cannot be combined with ${rest}`);
      }
      if (present.length === 0) {
        throw new GraphQLError("At least one of arguments is required: 'id', 'name', 'slug'.");
      }
      if (id) return getMenu(ctx.db, { id: fromGlobalId("Menu", String(id)) });
      if (name) return getMenu(ctx.db, { name: String(name) });
      return getMenu(ctx.db, { slug: String(slug) });
    },
  }),
);

builder.queryField("menuItem", (t) =>
  t.field({
    type: MenuItemType,
    nullable: true,
    description: "Look up a menu item by ID.",
    args: {
      id: t.arg.id({ required: true, description: "ID of the menu item." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      const menuItem = await getMenuItem(ctx.db, fromGlobalId("MenuItem", String(id)));
      if (!menuItem) return null;
      const items = await menuLoaders(ctx).menuItemsByMenuId.load(menuItem.menuId);
      return items.find((item) => item.id === menuItem.id) ?? null;
    },
  }),
);

const MenuConnection = builder.connectionObject(
  {
    type: MenuType,
    name: "MenuCountableConnection",
    fields: (t) => ({
      totalCount: t.int({
        nullable: true,
        description: "A total count of items in the collection.",
        resolve: (connection) => (connection as unknown as MenuPage).totalCount,
      }),
    }),
  },
  { name: "MenuCountableEdge" },
);

/** One page of menus in the connection shape, with Saleor's cursor errors. */
async function menuConnection(
  db: Parameters<typeof listMenus>[0],
  fieldName: string,
  args: MenuListArgs,
  edgesRequested: boolean,
) {
  const page = validatePagination(fieldName, args, edgesRequested);
  try {
    const result = await listMenus(db, {
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

const MenuSortFieldEnum = builder.enumType("MenuSortField", {
  values: {
    NAME: { description: "Sort menus by name." },
    ITEMS_COUNT: { description: "Sort menus by items count." },
  } as const,
});

const MenuSortingInput = builder.inputType("MenuSortingInput", {
  fields: (t) => ({
    direction: t.field({
      type: OrderDirection,
      required: true,
      description: "Specifies the direction in which to sort menus.",
    }),
    field: t.field({
      type: MenuSortFieldEnum,
      required: true,
      description: "Sort menus by the selected field.",
    }),
  }),
});

const MenuFilterInput = builder.inputType("MenuFilterInput", {
  fields: (t) => ({
    search: t.string({ description: "Search menus by name or slug." }),
    slugs: t.stringList({ description: "Filter menus by slug." }),
  }),
});

builder.queryField("menus", (t) =>
  t.connection(
    {
      type: MenuType,
      nullable: true,
      description: "List of the storefront's menus.",
      args: {
        filter: t.arg({
          type: MenuFilterInput,
          description: "Filtering options for menus.\n\n`slug`: Use `slugs` instead.",
        }),
        sortBy: t.arg({ type: MenuSortingInput, description: "Sort menus." }),
      },
      resolve: async (_parent, { filter, sortBy, ...page }, ctx, info) =>
        menuConnection(
          ctx.db,
          "menus",
          {
            ...page,
            search: filter?.search,
            slugs: filter?.slugs,
            sort: sortBy
              ? { direction: sortBy.direction, field: sortBy.field as MenuSortField }
              : null,
          },
          isEdgesRequested(info),
        ),
    },
    MenuConnection,
  ),
);

export const MenuErrorCode = builder.enumType("MenuErrorCode", {
  values: [
    "CANNOT_ASSIGN_NODE",
    "GRAPHQL_ERROR",
    "INVALID",
    "INVALID_MENU_ITEM",
    "NO_MENU_ITEM_PROVIDED",
    "NOT_FOUND",
    "REQUIRED",
    "TOO_MANY_MENU_ITEMS",
    "UNIQUE",
  ] as const,
});

const MenuErrorType = builder.objectRef<MenuError>("MenuError").implement({
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
      type: MenuErrorCode,
      description: "The error code.",
      resolve: (error) => error.code,
    }),
  }),
});

const MenuItemInputType = builder.inputType("MenuItemInput", {
  fields: (t) => ({
    name: t.string({ description: "Name of the menu item." }),
    url: t.string({ description: "URL of the pointed item." }),
    category: t.id({ description: "Category to which item points." }),
    collection: t.id({ description: "Collection to which item points." }),
    page: t.id({ description: "Page to which item points." }),
  }),
});

const MenuCreateInputType = builder.inputType("MenuCreateInput", {
  fields: (t) => ({
    name: t.string({ required: true, description: "Name of the menu." }),
    slug: t.string({ description: "Slug of the menu. Will be generated if not provided." }),
    items: t.field({ type: [MenuItemInputType], description: "List of menu items." }),
  }),
});

const MenuInput = builder.inputType("MenuInput", {
  fields: (t) => ({
    name: t.string({ description: "Name of the menu." }),
    slug: t.string({ description: "Slug of the menu." }),
  }),
});

const MenuItemCreateInputType = builder.inputType("MenuItemCreateInput", {
  fields: (t) => ({
    name: t.string({ required: true, description: "Name of the menu item." }),
    menu: t.id({ required: true, description: "Menu to which item belongs." }),
    parent: t.id({
      description: "ID of the parent menu. If empty, menu will be top level menu.",
    }),
    url: t.string({ description: "URL of the pointed item." }),
    category: t.id({ description: "Category to which item points." }),
    collection: t.id({ description: "Collection to which item points." }),
    page: t.id({ description: "Page to which item points." }),
  }),
});

const MenuItemMoveInput = builder.inputType("MenuItemMoveInput", {
  fields: (t) => ({
    itemId: t.id({ required: true, description: "The menu item ID to move." }),
    parentId: t.id({
      description: "ID of the parent menu. If empty, menu will be top level menu.",
    }),
    sortOrder: t.int({
      description:
        "The new relative sorting position of the item (from -inf to +inf). 1 moves the " +
        "item one position forward, -1 moves the item one position backward, 0 leaves the " +
        "item unchanged.",
    }),
  }),
});

type MenuPayload = { menu: MenuRow | null; errors: MenuError[] };
type MenuItemPayload = { menuItem: MenuItemNode | null; errors: MenuError[] };

const menuPayloadType = (name: string, description: string) =>
  builder.objectRef<MenuPayload>(name).implement({
    description,
    fields: (t) => ({
      menu: t.field({
        type: MenuType,
        nullable: true,
        description: "Menu created or updated by the mutation.",
        resolve: (payload) => payload.menu,
      }),
      errors: t.field({ type: [MenuErrorType], resolve: (payload) => payload.errors }),
    }),
  });

const menuItemPayloadType = (name: string, description: string) =>
  builder.objectRef<MenuItemPayload>(name).implement({
    description,
    fields: (t) => ({
      menuItem: t.field({
        type: MenuItemType,
        nullable: true,
        description: "Menu item created or updated by the mutation.",
        resolve: (payload) => payload.menuItem,
      }),
      errors: t.field({ type: [MenuErrorType], resolve: (payload) => payload.errors }),
    }),
  });

const CREATE_MENU_DESCRIPTION = `Creates a new Menu.\n\n${PERMISSION}`;
const UPDATE_MENU_DESCRIPTION = `Updates a menu.\n\n${PERMISSION}`;
const DELETE_MENU_DESCRIPTION = `Deletes a menu.\n\n${PERMISSION}`;
const BULK_DELETE_MENU_DESCRIPTION = `Deletes menus.\n\n${PERMISSION}`;
const ITEM_INPUT_DESCRIPTION =
  "Fields required to update a menu item. Only one of `url`, `category`, `page`, " +
  "`collection` is allowed per item.";
const CREATE_MENU_ITEM_DESCRIPTION = `Creates a new menu item.\n\n${PERMISSION}\n\n${ITEM_INPUT_DESCRIPTION}`;
const UPDATE_MENU_ITEM_DESCRIPTION = `Updates a menu item.\n\n${PERMISSION}\n\n${ITEM_INPUT_DESCRIPTION}`;
const DELETE_MENU_ITEM_DESCRIPTION = `Deletes a menu item.\n\n${PERMISSION}`;
const BULK_DELETE_MENU_ITEM_DESCRIPTION = `Deletes menu items.\n\n${PERMISSION}`;
const MOVE_DESCRIPTION = `Moves items of menus.\n\n${PERMISSION}`;

const MenuCreate = menuPayloadType("MenuCreate", CREATE_MENU_DESCRIPTION);
const MenuUpdate = menuPayloadType("MenuUpdate", UPDATE_MENU_DESCRIPTION);
const MenuDelete = menuPayloadType("MenuDelete", DELETE_MENU_DESCRIPTION);
const MenuItemCreate = menuItemPayloadType("MenuItemCreate", CREATE_MENU_ITEM_DESCRIPTION);
const MenuItemUpdate = menuItemPayloadType("MenuItemUpdate", UPDATE_MENU_ITEM_DESCRIPTION);
const MenuItemDelete = menuItemPayloadType("MenuItemDelete", DELETE_MENU_ITEM_DESCRIPTION);

const menuPayload = (result: MenuResult): MenuPayload =>
  result.ok ? { menu: result.menu, errors: [] } : { menu: null, errors: result.errors };

const menuItemPayload = (result: MenuItemResult): MenuItemPayload =>
  result.ok ? { menuItem: result.menuItem, errors: [] } : { menuItem: null, errors: result.errors };

/** Maps unknown menus/items to Saleor's top-level node error. */
async function runNode<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof MenuNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId("Menu", id)));
    }
    if (error instanceof MenuItemNotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId("MenuItem", id)));
    }
    throw error;
  }
}

const invalidMenuItem = (field: string, expected: string, received: string): MenuError => ({
  field,
  code: "INVALID_MENU_ITEM",
  message: `Enter a valid ${expected.toLowerCase()} ID (got ${received.toLowerCase()} ID).`,
});

/**
 * Decodes an ID in a mutation. A wrong type becomes a payload error; a malformed global ID stays
 * a top-level error (Saleor's from_global_id_or_error).
 */
function decodeMutationId(
  globalId: string,
  field: string,
  expected: string,
  errors: MenuError[],
): string | null {
  const { typename, id } = decodeGlobalId(globalId);
  if (typename !== expected) {
    errors.push(invalidMenuItem(field, expected, typename));
    return null;
  }
  return id;
}

type DecodedTargets = {
  url: string | null;
  category: string | null;
  collection: string | null;
  page: string | null;
};

function decodeTargets(
  input: {
    url?: string | null;
    category?: string | null;
    collection?: string | null;
    page?: string | null;
  },
  field: string | null,
  errors: MenuError[],
): DecodedTargets {
  const decode = (globalId: string | null | undefined, expected: string) => {
    if (!globalId) return null;
    return decodeMutationId(globalId, field ?? expected.toLowerCase(), expected, errors);
  };
  return {
    url: input.url ?? null,
    category: decode(input.category, "Category"),
    collection: decode(input.collection, "Collection"),
    page: decode(input.page, "Page"),
  };
}

builder.mutationField("menuCreate", (t) =>
  t.field({
    type: MenuCreate,
    description: CREATE_MENU_DESCRIPTION,
    args: {
      input: t.arg({
        type: MenuCreateInputType,
        required: true,
        description: "Fields required to create a menu.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");

      const errors: MenuError[] = [];
      const items: MenuItemInput[] = [];
      for (const item of input.items ?? []) {
        const targets = decodeTargets(item, "items", errors);
        items.push({ name: item.name ?? "", ...targets });
      }
      if (errors.length > 0) return { menu: null, errors };

      const menuInput: MenuCreateInput = {
        name: input.name,
        slug: input.slug ?? undefined,
        items,
      };
      return menuPayload(await createMenu(ctx.db, menuInput));
    },
  }),
);

builder.mutationField("menuUpdate", (t) =>
  t.field({
    type: MenuUpdate,
    description: UPDATE_MENU_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a menu to update." }),
      input: t.arg({
        type: MenuInput,
        required: true,
        description: "Fields required to update a menu.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");
      const update: MenuUpdateInput = {
        name: input.name ?? undefined,
        slug: input.slug ?? undefined,
      };
      return menuPayload(
        await runNode(() => updateMenu(ctx.db, fromGlobalId("Menu", String(id)), update)),
      );
    },
  }),
);

builder.mutationField("menuDelete", (t) =>
  t.field({
    type: MenuDelete,
    description: DELETE_MENU_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a menu to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");
      const menu = await runNode(() => deleteMenu(ctx.db, fromGlobalId("Menu", String(id))));
      return { menu, errors: [] };
    },
  }),
);

type BulkDeletePayload = { count: number; errors: MenuError[] };

const bulkDeletePayloadType = (name: string, description: string) =>
  builder.objectRef<BulkDeletePayload>(name).implement({
    description,
    fields: (t) => ({
      count: t.exposeInt("count", { description: "Returns how many objects were affected." }),
      errors: t.field({ type: [MenuErrorType], resolve: (payload) => payload.errors }),
    }),
  });

const MenuBulkDelete = bulkDeletePayloadType("MenuBulkDelete", BULK_DELETE_MENU_DESCRIPTION);
const MenuItemBulkDelete = bulkDeletePayloadType(
  "MenuItemBulkDelete",
  BULK_DELETE_MENU_ITEM_DESCRIPTION,
);

builder.mutationField("menuBulkDelete", (t) =>
  t.field({
    type: MenuBulkDelete,
    nullable: true,
    description: BULK_DELETE_MENU_DESCRIPTION,
    args: {
      ids: t.arg.idList({ required: true, description: "List of menu IDs to delete." }),
    },
    resolve: async (_parent, { ids }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");
      const { count } = await runNode(() =>
        deleteMenus(
          ctx.db,
          ids.map((id) => fromGlobalId("Menu", String(id))),
        ),
      );
      return { count, errors: [] };
    },
  }),
);

builder.mutationField("menuItemCreate", (t) =>
  t.field({
    type: MenuItemCreate,
    description: CREATE_MENU_ITEM_DESCRIPTION,
    args: {
      input: t.arg({
        type: MenuItemCreateInputType,
        required: true,
        description: "Fields required to create a menu item.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");

      const errors: MenuError[] = [];
      const menu = decodeMutationId(input.menu, "menu", "Menu", errors);
      const parent = input.parent
        ? decodeMutationId(input.parent, "parent", "MenuItem", errors)
        : null;
      const targets = decodeTargets(input, null, errors);
      if (errors.length > 0 || menu === null) return { menuItem: null, errors };

      const create: MenuItemCreateInput = { menu, parent, name: input.name, ...targets };
      return menuItemPayload(await createMenuItem(ctx.db, create));
    },
  }),
);

builder.mutationField("menuItemUpdate", (t) =>
  t.field({
    type: MenuItemUpdate,
    description: UPDATE_MENU_ITEM_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a menu item to update." }),
      input: t.arg({
        type: MenuItemInputType,
        required: true,
        description: "Fields required to update a menu item.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");

      const errors: MenuError[] = [];
      const targets = decodeTargets(input, null, errors);
      if (errors.length > 0) return { menuItem: null, errors };

      // Only a given target replaces the item's link; a rename alone keeps it (ARCHITECTURE §4).
      const targetGiven = [input.url, input.category, input.collection, input.page].some(
        (value) => value != null,
      );
      const update: MenuItemUpdateInput = {
        name: input.name ?? undefined,
        ...(targetGiven ? targets : {}),
      };
      return menuItemPayload(
        await runNode(() => updateMenuItem(ctx.db, fromGlobalId("MenuItem", String(id)), update)),
      );
    },
  }),
);

builder.mutationField("menuItemDelete", (t) =>
  t.field({
    type: MenuItemDelete,
    description: DELETE_MENU_ITEM_DESCRIPTION,
    args: {
      id: t.arg.id({ required: true, description: "ID of a menu item to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");
      const menuItem = await runNode(() =>
        deleteMenuItem(ctx.db, fromGlobalId("MenuItem", String(id))),
      );
      return { menuItem, errors: [] };
    },
  }),
);

builder.mutationField("menuItemBulkDelete", (t) =>
  t.field({
    type: MenuItemBulkDelete,
    nullable: true,
    description: BULK_DELETE_MENU_ITEM_DESCRIPTION,
    args: {
      ids: t.arg.idList({ required: true, description: "List of menu item IDs to delete." }),
    },
    resolve: async (_parent, { ids }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");
      const { count } = await runNode(() =>
        deleteMenuItems(
          ctx.db,
          ids.map((id) => fromGlobalId("MenuItem", String(id))),
        ),
      );
      return { count, errors: [] };
    },
  }),
);

type MovePayload = { menu: MenuRow | null; errors: MenuError[] };

const MenuItemMove = builder.objectRef<MovePayload>("MenuItemMove").implement({
  description: MOVE_DESCRIPTION,
  fields: (t) => ({
    menu: t.field({
      type: MenuType,
      nullable: true,
      description: "Assigned menu to move within.",
      resolve: (payload) => payload.menu,
    }),
    errors: t.field({ type: [MenuErrorType], resolve: (payload) => payload.errors }),
  }),
});

builder.mutationField("menuItemMove", (t) =>
  t.field({
    type: MenuItemMove,
    description: MOVE_DESCRIPTION,
    args: {
      menu: t.arg.id({ required: true, description: "ID of the menu." }),
      moves: t.arg({
        type: [MenuItemMoveInput],
        required: true,
        description: "The menu position data.",
      }),
    },
    resolve: async (_parent, { menu, moves }, ctx) => {
      await requirePermission(ctx, "MANAGE_MENUS");

      const errors: MenuError[] = [];
      const menuId = decodeMutationId(String(menu), "menu", "Menu", errors);
      const decoded: MenuItemMoveOperation[] = [];
      for (const move of moves) {
        const itemId = decodeMutationId(String(move.itemId), "item", "MenuItem", errors);
        const parentId = move.parentId
          ? decodeMutationId(String(move.parentId), "parentId", "MenuItem", errors)
          : null;
        if (itemId) decoded.push({ itemId, parentId, sortOrder: move.sortOrder ?? null });
      }
      if (errors.length > 0 || menuId === null) return { menu: null, errors };

      const result = await moveMenuItems(ctx.db, menuId, decoded);
      return result.ok ? { menu: result.menu, errors: [] } : { menu: null, errors: result.errors };
    },
  }),
);
