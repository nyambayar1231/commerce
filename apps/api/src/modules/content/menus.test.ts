import { closeDb, createDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import {
  createMenu,
  createMenuItem,
  deleteMenu,
  deleteMenuItem,
  deleteMenuItems,
  deleteMenus,
  getMenuItem,
  getMenuItems,
  listMenus,
  type MenuCreateInput,
  type MenuItemCreateInput,
  type MenuItemNode,
  MenuItemNotFoundError,
  MenuNotFoundError,
  type MenuResult,
  type MenuRow,
  moveMenuItems,
  updateMenu,
  updateMenuItem,
} from "./index.ts";

// Domain and GraphQL contract tests for Saleor's menus (M15.6b), against the real (test) database
// and the real Yoga app.

const db = getDb();
const client = createTestClient(db);

const counted: string[] = [];
const countingDb = createDb(databaseUrl(), { onQuery: (statement) => counted.push(statement) });
const countingClient = createTestClient(countingDb);

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see apps/api/vitest.config.ts)");
  return url;
}

const domainQueries = () =>
  counted.filter((statement) => !statement.includes("pg_catalog.pg_type"));

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, menu, category, collection, page CASCADE',
  );
});

afterAll(async () => {
  await countingDb.$client.end({ timeout: 5 });
  await closeDb();
});

async function mustCreateMenu(input: MenuCreateInput): Promise<MenuRow> {
  const result = await createMenu(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.menu;
}

async function mustCreateItem(input: MenuItemCreateInput): Promise<MenuItemNode> {
  const result = await createMenuItem(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.menuItem;
}

function expectFailure(result: MenuResult) {
  if (result.ok) throw new Error("expected menu validation to fail");
  return result.errors;
}

async function seedCategory(name = "Shoes") {
  const [row] = await db
    .insert(schema.category)
    .values({ name, slug: name.toLowerCase() })
    .returning();
  if (!row) throw new Error("no category");
  return row;
}

async function seedCollection(name = "Featured", isPublished = true) {
  const [row] = await db
    .insert(schema.collection)
    .values({ name, slug: name.toLowerCase(), isPublished, publishedAt: new Date() })
    .returning();
  if (!row) throw new Error("no collection");
  return row;
}

async function seedPage(title = "About us", isPublished = true) {
  const [row] = await db
    .insert(schema.page)
    .values({ title, slug: title.toLowerCase().replace(/\s+/g, "-"), isPublished })
    .returning();
  if (!row) throw new Error("no page");
  return row;
}

const menuId = (id: string) => toGlobalId("Menu", id);
const itemId = (id: string) => toGlobalId("MenuItem", id);
const categoryId = (id: string) => toGlobalId("Category", id);
const pageId = (id: string) => toGlobalId("Page", id);

describe("createMenu and updateMenu", () => {
  it("creates a menu with a generated slug and ordered top-level items", async () => {
    const category = await seedCategory();
    const menu = await mustCreateMenu({
      name: "  Main navigation  ",
      items: [
        { name: "Shop", category: category.id },
        { name: "Home", url: "/" },
      ],
    });

    expect(menu).toMatchObject({ name: "Main navigation", slug: "main-navigation" });
    const items = await getMenuItems(db, menu.id);
    expect(items.map((item) => [item.name, item.level, item.sortOrder])).toEqual([
      ["Shop", 0, 0],
      ["Home", 0, 1],
    ]);
  });

  it("generates the first free slug suffix", async () => {
    await mustCreateMenu({ name: "Footer" });
    const second = await mustCreateMenu({ name: "Footer" });
    expect(second.slug).toBe("footer-2");
  });

  it("reports blank names, invalid and taken slugs, and bad items without writing", async () => {
    await mustCreateMenu({ name: "Existing", slug: "taken" });

    expect(
      expectFailure(
        await createMenu(db, {
          name: " ",
          slug: "not valid!",
          items: [
            { name: "Nothing" },
            { name: "Two", url: "/a", page: crypto.randomUUID() },
            { name: "Bad URL", url: "ftp://example.com" },
          ],
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        { field: "name", code: "REQUIRED", message: "This field cannot be blank." },
        expect.objectContaining({ field: "slug", code: "INVALID" }),
        { field: "items", code: "NO_MENU_ITEM_PROVIDED", message: "No menu item provided." },
        { field: "items", code: "TOO_MANY_MENU_ITEMS", message: "More than one item provided." },
        { field: "items", code: "INVALID", message: "Enter a valid URL." },
      ]),
    );

    const taken = await createMenu(db, { name: "Other", slug: "taken" });
    expect(expectFailure(taken)).toEqual([
      { field: "slug", code: "UNIQUE", message: "Menu with this Slug already exists." },
    ]);

    expect(await db.select().from(schema.menu)).toHaveLength(1);
  });

  it("updates the name and slug, and refuses an unknown menu", async () => {
    const menu = await mustCreateMenu({ name: "Old", slug: "old" });
    const updated = await updateMenu(db, menu.id, { name: "New", slug: "new" });
    if (!updated.ok) throw new Error(JSON.stringify(updated.errors));
    expect(updated.menu).toMatchObject({ name: "New", slug: "new" });
    expect(updated.menu.updatedAt.getTime()).toBeGreaterThanOrEqual(menu.updatedAt.getTime());

    const missing = crypto.randomUUID();
    await expect(updateMenu(db, missing, { name: "Missing" })).rejects.toEqual(
      expect.objectContaining({ kind: "Menu", ids: [missing] }),
    );
  });
});

describe("menu item create, update and delete", () => {
  it("appends new items last among their siblings", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const first = await mustCreateItem({ menu: menu.id, name: "First", url: "/first" });
    await mustCreateItem({ menu: menu.id, name: "Second", url: "/second" });
    const child = await mustCreateItem({
      menu: menu.id,
      parent: first.id,
      name: "Child",
      url: "/child",
    });

    const items = await getMenuItems(db, menu.id);
    expect(items.map((item) => [item.name, item.sortOrder, item.level])).toEqual([
      ["First", 0, 0],
      ["Child", 0, 1],
      ["Second", 1, 0],
    ]);
    expect(child.level).toBe(1);
  });

  it("stops at three levels and refuses a parent from another menu", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const other = await mustCreateMenu({ name: "Other" });
    const root = await mustCreateItem({ menu: menu.id, name: "Root", url: "/" });
    const child = await mustCreateItem({ menu: menu.id, parent: root.id, name: "Child" });
    const grandchild = await mustCreateItem({ menu: menu.id, parent: child.id, name: "Grand" });

    const deeper = await createMenuItem(db, {
      menu: menu.id,
      parent: grandchild.id,
      name: "Too deep",
      url: "/deep",
    });
    expect(expectFailureMenuItem(deeper)).toEqual([
      {
        field: "parent",
        code: "INVALID",
        message: "Menu items can be nested at most 3 levels deep.",
      },
    ]);

    const wrongMenu = await createMenuItem(db, {
      menu: other.id,
      parent: root.id,
      name: "Wrong",
      url: "/wrong",
    });
    expect(expectFailureMenuItem(wrongMenu)).toEqual([
      {
        field: "parent",
        code: "INVALID",
        message: "Parent menu item must belong to the same menu.",
      },
    ]);
  });

  it("validates one target, the URL and target existence", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const category = await seedCategory();

    const two = await createMenuItem(db, {
      menu: menu.id,
      name: "Two",
      category: category.id,
      url: "/also",
    });
    expect(expectFailureMenuItem(two)).toEqual([
      { field: null, code: "TOO_MANY_MENU_ITEMS", message: "More than one item provided." },
    ]);

    const invalidUrl = await createMenuItem(db, {
      menu: menu.id,
      name: "Bad",
      url: "mailto:hi@example.com",
    });
    expect(expectFailureMenuItem(invalidUrl)).toEqual([
      { field: "url", code: "INVALID", message: "Enter a valid URL." },
    ]);

    const missing = crypto.randomUUID();
    const unknown = await createMenuItem(db, {
      menu: menu.id,
      name: "Unknown",
      page: missing,
    });
    expect(expectFailureMenuItem(unknown)).toEqual([
      {
        field: "page",
        code: "NOT_FOUND",
        message: `Couldn't resolve to a node: ${pageId(missing)}`,
      },
    ]);
  });

  it("clears the previous target when a new one is set, as Saleor", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const category = await seedCategory();
    const page = await seedPage();

    const item = await mustCreateItem({
      menu: menu.id,
      name: "Item",
      category: category.id,
    });

    const updated = await updateMenuItem(db, item.id, { url: "/new" });
    if (!updated.ok) throw new Error(JSON.stringify(updated.errors));
    expect(updated.menuItem).toMatchObject({
      url: "/new",
      categoryId: null,
      collectionId: null,
      pageId: null,
    });

    const asPage = await updateMenuItem(db, item.id, { page: page.id });
    if (!asPage.ok) throw new Error(JSON.stringify(asPage.errors));
    expect(asPage.menuItem).toMatchObject({ url: null, pageId: page.id });

    // A name-only update keeps the target (ours: Saleor's construct_instance would clear it).
    const renamed = await updateMenuItem(db, item.id, { name: "Renamed" });
    if (!renamed.ok) throw new Error(JSON.stringify(renamed.errors));
    expect(renamed.menuItem).toMatchObject({ name: "Renamed", pageId: page.id });
  });

  it("deletes children with their parent and keeps sibling orders dense", async () => {
    const menu = await mustCreateMenu({
      name: "Nav",
      items: [
        { name: "A", url: "/a" },
        { name: "B", url: "/b" },
        { name: "C", url: "/c" },
      ],
    });
    const items = await getMenuItems(db, menu.id);
    const b = items.find((item) => item.name === "B");
    if (!b) throw new Error("no B");
    await mustCreateItem({ menu: menu.id, parent: b.id, name: "B child", url: "/bc" });

    await deleteMenuItem(db, b.id);

    const left = await getMenuItems(db, menu.id);
    expect(left.map((item) => [item.name, item.sortOrder])).toEqual([
      ["A", 0],
      ["C", 1],
    ]);
    expect(await getMenuItem(db, b.id)).toBeNull();

    await expect(deleteMenuItem(db, b.id)).rejects.toBeInstanceOf(MenuItemNotFoundError);
  });

  it("bulk deletes items and menus, counting duplicate ids once", async () => {
    const first = await mustCreateMenu({ name: "First", items: [{ name: "One", url: "/" }] });
    await mustCreateMenu({ name: "Second" });

    const [item] = await getMenuItems(db, first.id);
    if (!item) throw new Error("no item");
    await expect(deleteMenuItems(db, [item.id, item.id])).resolves.toEqual({ count: 1 });
    await expect(deleteMenus(db, [first.id, first.id])).resolves.toEqual({ count: 1 });

    const unknown = crypto.randomUUID();
    await expect(deleteMenus(db, [crypto.randomUUID(), unknown])).rejects.toBeInstanceOf(
      MenuNotFoundError,
    );
    await expect(deleteMenu(db, crypto.randomUUID())).rejects.toBeInstanceOf(MenuNotFoundError);
  });

  it("removes items whose category, collection or page is deleted", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const category = await seedCategory();
    const collection = await seedCollection();
    const page = await seedPage();
    await mustCreateItem({ menu: menu.id, name: "Category", category: category.id });
    await mustCreateItem({ menu: menu.id, name: "Collection", collection: collection.id });
    await mustCreateItem({ menu: menu.id, name: "Page", page: page.id });

    await db.delete(schema.category).where(eq(schema.category.id, category.id));
    await db.delete(schema.collection).where(eq(schema.collection.id, collection.id));
    await db.delete(schema.page).where(eq(schema.page.id, page.id));

    expect(await getMenuItems(db, menu.id)).toEqual([]);
  });
});

describe("moveMenuItems", () => {
  async function seedThree() {
    const menu = await mustCreateMenu({
      name: "Nav",
      items: [
        { name: "A", url: "/a" },
        { name: "B", url: "/b" },
        { name: "C", url: "/c" },
      ],
    });
    const items = await getMenuItems(db, menu.id);
    const [a, b, c] = items;
    if (!a || !b || !c) throw new Error("bad seed");
    return { menu, a, b, c };
  }

  const names = async (menu: MenuRow) =>
    (await getMenuItems(db, menu.id)).map((item) => [item.name, item.sortOrder]);

  it("reorders siblings with a relative sort order and keeps orders dense", async () => {
    const { menu, c } = await seedThree();

    const result = await moveMenuItems(db, menu.id, [
      { itemId: c.id, parentId: null, sortOrder: -2 },
    ]);
    expect(result.ok).toBe(true);
    expect(await names(menu)).toEqual([
      ["C", 0],
      ["A", 1],
      ["B", 2],
    ]);
  });

  it("moves an item under another parent, then back to the top level", async () => {
    const { menu, a, c } = await seedThree();

    await moveMenuItems(db, menu.id, [{ itemId: c.id, parentId: a.id, sortOrder: null }]);
    const items = await getMenuItems(db, menu.id);
    const moved = new Map(items.map((item) => [item.name, item]));
    expect(moved.get("A")).toMatchObject({ parentId: null, level: 0, sortOrder: 0 });
    expect(moved.get("B")).toMatchObject({ parentId: null, level: 0, sortOrder: 1 });
    expect(moved.get("C")).toMatchObject({ parentId: a.id, level: 1, sortOrder: 0 });

    await moveMenuItems(db, menu.id, [{ itemId: c.id, parentId: null, sortOrder: -1 }]);
    expect(await names(menu)).toEqual([
      ["A", 0],
      ["C", 1],
      ["B", 2],
    ]);
  });

  it("refuses cycles and moves deeper than three levels", async () => {
    const { menu, a, b, c } = await seedThree();
    await moveMenuItems(db, menu.id, [{ itemId: b.id, parentId: a.id, sortOrder: null }]);
    await moveMenuItems(db, menu.id, [{ itemId: c.id, parentId: b.id, sortOrder: null }]);

    const cycle = await moveMenuItems(db, menu.id, [
      { itemId: a.id, parentId: c.id, sortOrder: null },
    ]);
    expect(cycle.ok).toBe(false);
    expect(cycle.ok ? [] : cycle.errors).toEqual([
      {
        field: "parentId",
        code: "CANNOT_ASSIGN_NODE",
        message: "Cannot assign a node as child of one of its descendants.",
      },
    ]);

    const self = await moveMenuItems(db, menu.id, [
      { itemId: a.id, parentId: a.id, sortOrder: null },
    ]);
    expect(self.ok ? [] : self.errors).toEqual([
      { field: "parentId", code: "CANNOT_ASSIGN_NODE", message: "Cannot assign a node to itself." },
    ]);

    // A -> B -> C is three levels: an item with no children may not go under C...
    const leaf = await mustCreateItem({ menu: menu.id, name: "Leaf", url: "/leaf" });
    const tooDeep = await moveMenuItems(db, menu.id, [
      { itemId: leaf.id, parentId: c.id, sortOrder: null },
    ]);
    expect(tooDeep.ok ? [] : tooDeep.errors).toEqual([
      {
        field: "parentId",
        code: "INVALID",
        message: "Menu items can be nested at most 3 levels deep.",
      },
    ]);

    // ...and a subtree must fit: X (with child Y) under B would put Y at level 3.
    const x = await mustCreateItem({ menu: menu.id, name: "X", url: "/x" });
    await mustCreateItem({ menu: menu.id, parent: x.id, name: "Y", url: "/y" });
    const subtreeTooDeep = await moveMenuItems(db, menu.id, [
      { itemId: x.id, parentId: b.id, sortOrder: null },
    ]);
    expect(subtreeTooDeep.ok ? [] : subtreeTooDeep.errors).toEqual([
      {
        field: "parentId",
        code: "INVALID",
        message: "Menu items can be nested at most 3 levels deep.",
      },
    ]);
  });
});

describe("listMenus", () => {
  it("searches and filters by slug", async () => {
    await mustCreateMenu({ name: "Main navigation", items: [{ name: "One", url: "/" }] });
    await mustCreateMenu({ name: "Footer" });

    expect((await listMenus(db, { first: 10, search: "MAIN" })).rows).toHaveLength(1);
    expect((await listMenus(db, { first: 10, slugs: ["footer"] })).rows[0]?.node.name).toBe(
      "Footer",
    );
    expect((await listMenus(db, { first: 10, slugs: [] })).rows).toEqual([]);
  });

  it("sorts by name and item count with totalCount", async () => {
    await mustCreateMenu({ name: "B", items: [{ name: "One", url: "/" }] });
    await mustCreateMenu({
      name: "A",
      items: [
        { name: "One", url: "/" },
        { name: "Two", url: "/two" },
      ],
    });
    await mustCreateMenu({ name: "C" });

    const byName = await listMenus(db, { first: 10 });
    expect(byName.rows.map((row) => row.node.name)).toEqual(["A", "B", "C"]);
    expect(byName.totalCount).toBe(3);

    const byCount = await listMenus(db, {
      first: 10,
      sort: { field: "ITEMS_COUNT", direction: "DESC" },
    });
    expect(byCount.rows.map((row) => [row.node.name, row.node.itemsCount])).toEqual([
      ["A", 2],
      ["B", 1],
      ["C", 0],
    ]);
  });
});

function expectFailureMenuItem(
  result: Awaited<ReturnType<typeof createMenuItem>>,
): { field: string | null; code: string; message: string }[] {
  if (result.ok) throw new Error("expected menu item validation to fail");
  return result.errors;
}

// ---------------------------------------------------------------------------------------------
// GraphQL

const MENU_TREE = `query ($slug: String, $id: ID, $name: String) {
  menu(slug: $slug, id: $id, name: $name) {
    id
    name
    slug
    items {
      id
      name
      level
      url
      category { slug }
      collection { slug }
      page { slug }
      parent { id }
      children {
        id
        name
        level
        category { slug }
        collection { slug }
        page { slug }
        children {
          id
          name
          level
          category { slug }
          collection { slug }
          page { slug }
        }
      }
    }
  }
}`;

const MENUS = `query ($first: Int, $filter: MenuFilterInput, $sortBy: MenuSortingInput) {
  menus(first: $first, filter: $filter, sortBy: $sortBy) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges { cursor node { id name slug } }
  }
}`;

const CREATE_MENU = `mutation ($input: MenuCreateInput!) {
  menuCreate(input: $input) { menu { id name slug items { name } } errors { field code message } }
}`;
const CREATE_ITEM = `mutation ($input: MenuItemCreateInput!) {
  menuItemCreate(input: $input) { menuItem { id name url level } errors { field code message } }
}`;
const UPDATE_ITEM = `mutation ($id: ID!, $input: MenuItemInput!) {
  menuItemUpdate(id: $id, input: $input) {
    menuItem { id name url category { id } collection { id } page { id } }
    errors { field code message }
  }
}`;
const MOVE = `mutation ($menu: ID!, $moves: [MenuItemMoveInput!]!) {
  menuItemMove(menu: $menu, moves: $moves) {
    menu { id items { name children { name children { name } } } }
    errors { field code message }
  }
}`;

type MenuTree = {
  id: string;
  name: string;
  slug: string;
  items: {
    id: string;
    name: string;
    level: number;
    url: string | null;
    category: { slug: string } | null;
    collection: { slug: string } | null;
    page: { slug: string } | null;
    children: {
      id: string;
      name: string;
      level: number;
      category: { slug: string } | null;
      collection: { slug: string } | null;
      page: { slug: string } | null;
      children: { name: string; level: number }[];
    }[];
  }[];
};

async function menuTree(variables: object, token?: string): Promise<MenuTree | null> {
  const result = await client.gql(MENU_TREE, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { menu: MenuTree | null }).menu;
}

const errorOf = (result: GqlResult) => result.body.errors?.[0]?.message;

describe("menu and menus queries", () => {
  it("returns the tree in sibling order with computed levels", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const root = await mustCreateItem({ menu: menu.id, name: "Root", url: "/" });
    const child = await mustCreateItem({ menu: menu.id, parent: root.id, name: "Child" });
    await mustCreateItem({ menu: menu.id, parent: child.id, name: "Grandchild" });
    await mustCreateItem({ menu: menu.id, name: "Second", url: "/second" });

    const tree = await menuTree({ slug: menu.slug });
    expect(tree?.items.map((item) => item.name)).toEqual(["Root", "Second"]);
    expect(tree?.items[0]).toMatchObject({
      level: 0,
      url: "/",
      children: [{ name: "Child", level: 1, children: [{ name: "Grandchild", level: 2 }] }],
    });
  });

  it("hides unpublished collection and page targets from the public, not from staff", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const category = await seedCategory();
    const collection = await seedCollection("Hidden", false);
    const page = await seedPage("Draft", false);
    await mustCreateItem({ menu: menu.id, name: "Category", category: category.id });
    await mustCreateItem({ menu: menu.id, name: "Collection", collection: collection.id });
    await mustCreateItem({ menu: menu.id, name: "Page", page: page.id });

    const publicTree = await menuTree({ slug: menu.slug });
    expect(publicTree?.items).toMatchObject([
      { name: "Category", category: { slug: "shoes" }, collection: null, page: null },
      { name: "Collection", category: null, collection: null, page: null },
      { name: "Page", category: null, collection: null, page: null },
    ]);

    const products = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const productsTree = await menuTree({ slug: menu.slug }, products.token);
    expect(productsTree?.items[1]).toMatchObject({ collection: { slug: "hidden" }, page: null });

    const pages = await createStaff(db, ["MANAGE_PAGES"]);
    const pagesTree = await menuTree({ slug: menu.slug }, pages.token);
    expect(pagesTree?.items[2]).toMatchObject({ collection: null, page: { slug: "draft" } });
  });

  it("looks menus up by id or name, needs exactly one argument and supports the connection", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });

    expect((await menuTree({ id: menuId(menu.id) }))?.slug).toBe("nav");
    expect((await menuTree({ name: "Nav" }))?.id).toBe(menuId(menu.id));

    expect(errorOf(await client.gql(MENU_TREE, {}))).toBe(
      "At least one of arguments is required: 'id', 'name', 'slug'.",
    );
    expect(errorOf(await client.gql(MENU_TREE, { id: menuId(menu.id), slug: "nav" }))).toBe(
      "Argument 'id' cannot be combined with 'slug'",
    );

    const result = await client.gql(MENUS, { first: 10 });
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toMatchObject({
      menus: {
        totalCount: 1,
        edges: [{ node: { id: menuId(menu.id), name: "Nav", slug: "nav" } }],
      },
    });
  });

  it("resolves a three-level menu in a bounded number of queries", async () => {
    const menu = await mustCreateMenu({ name: "Nav" });
    const category = await seedCategory();
    const collection = await seedCollection();
    const page = await seedPage();
    const root = await mustCreateItem({
      menu: menu.id,
      name: "Root",
      category: category.id,
    });
    const child = await mustCreateItem({ menu: menu.id, parent: root.id, name: "Child" });
    await mustCreateItem({
      menu: menu.id,
      parent: child.id,
      name: "Collection",
      collection: collection.id,
    });
    await mustCreateItem({ menu: menu.id, parent: child.id, name: "Page", page: page.id });

    const request = async (slug: string) => {
      counted.length = 0;
      const result = await countingClient.gql(MENU_TREE, { slug });
      expect(result.body.errors).toBeUndefined();
      return domainQueries().length;
    };

    const before = await request(menu.slug);
    expect(before).toBe(5);

    for (let index = 0; index < 5; index += 1) {
      await mustCreateItem({ menu: menu.id, name: `More ${index}`, url: "/more" });
    }
    expect(await request(menu.slug)).toBe(before);
  });
});

describe("menu mutations over GraphQL", () => {
  it("creates a menu with items and reports item validation errors", async () => {
    const admin = await createStaff(db, ["MANAGE_MENUS"]);
    const category = await seedCategory();

    const created = await client.gql(
      CREATE_MENU,
      {
        input: {
          name: "Storefront",
          items: [
            { name: "Shop", category: categoryId(category.id) },
            { name: "Home", url: "/" },
          ],
        },
      },
      admin.token,
    );
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data).toMatchObject({
      menuCreate: {
        menu: {
          name: "Storefront",
          slug: "storefront",
          items: [{ name: "Shop" }, { name: "Home" }],
        },
        errors: [],
      },
    });

    const invalid = await client.gql(
      CREATE_MENU,
      { input: { name: "Bad", items: [{ name: "Nothing" }] } },
      admin.token,
    );
    expect(invalid.body.data).toMatchObject({
      menuCreate: {
        menu: null,
        errors: [
          { field: "items", code: "NO_MENU_ITEM_PROVIDED", message: "No menu item provided." },
        ],
      },
    });
  });

  it("creates items, moves them and rejects a wrong-typed target id", async () => {
    const admin = await createStaff(db, ["MANAGE_MENUS"]);
    const menu = await mustCreateMenu({ name: "Nav" });
    const product = toGlobalId("Product", crypto.randomUUID());

    const wrongType = await client.gql(
      CREATE_ITEM,
      { input: { name: "Bad", menu: menuId(menu.id), category: product } },
      admin.token,
    );
    expect(wrongType.body.data).toMatchObject({
      menuItemCreate: {
        menuItem: null,
        errors: [
          {
            field: "category",
            code: "INVALID_MENU_ITEM",
            message: "Enter a valid category ID (got product ID).",
          },
        ],
      },
    });

    const first = await client.gql(
      CREATE_ITEM,
      { input: { name: "A", menu: menuId(menu.id), url: "/a" } },
      admin.token,
    );
    expect(first.body.data).toMatchObject({
      menuItemCreate: { menuItem: { name: "A", url: "/a", level: 0 }, errors: [] },
    });

    const [item] = await getMenuItems(db, menu.id);
    if (!item) throw new Error("no item");
    const result = await client.gql(
      MOVE,
      {
        menu: menuId(menu.id),
        moves: [{ itemId: itemId(item.id), parentId: null, sortOrder: 0 }],
      },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toMatchObject({ menuItemMove: { errors: [] } });
  });

  it("updates an item and clears its previous target", async () => {
    const admin = await createStaff(db, ["MANAGE_MENUS"]);
    const menu = await mustCreateMenu({ name: "Nav" });
    const category = await seedCategory();
    const page = await seedPage();
    const item = await mustCreateItem({ menu: menu.id, name: "Item", category: category.id });

    const result = await client.gql(
      UPDATE_ITEM,
      { id: itemId(item.id), input: { name: "Renamed", page: pageId(page.id) } },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toMatchObject({
      menuItemUpdate: {
        menuItem: {
          name: "Renamed",
          category: null,
          page: { id: pageId(page.id) },
        },
        errors: [],
      },
    });

    // A rename alone keeps the link.
    const renamed = await client.gql(
      UPDATE_ITEM,
      { id: itemId(item.id), input: { name: "Again" } },
      admin.token,
    );
    expect(renamed.body.data).toMatchObject({
      menuItemUpdate: { menuItem: { name: "Again", page: { id: pageId(page.id) } }, errors: [] },
    });
  });
});

describe("every menu mutation requires MANAGE_MENUS", () => {
  const docs = () =>
    [
      {
        name: "menuCreate",
        doc: `mutation { menuCreate(input: { name: "Guarded" }) { errors { code } } }`,
        vars: async () => ({}),
      },
      {
        name: "menuUpdate",
        doc: `mutation ($id: ID!) { menuUpdate(id: $id, input: { name: "x" }) { errors { code } } }`,
        vars: async () => ({ id: menuId((await mustCreateMenu({ name: "Guarded" })).id) }),
      },
      {
        name: "menuDelete",
        doc: `mutation ($id: ID!) { menuDelete(id: $id) { errors { code } } }`,
        vars: async () => ({ id: menuId((await mustCreateMenu({ name: "Guarded" })).id) }),
      },
      {
        name: "menuBulkDelete",
        doc: `mutation ($ids: [ID!]!) { menuBulkDelete(ids: $ids) { count errors { code } } }`,
        vars: async () => ({ ids: [menuId((await mustCreateMenu({ name: "Guarded" })).id)] }),
      },
      {
        name: "menuItemCreate",
        doc: `mutation ($input: MenuItemCreateInput!) { menuItemCreate(input: $input) { errors { code } } }`,
        vars: async () => ({
          input: { name: "Guarded", menu: menuId((await mustCreateMenu({ name: "Guarded" })).id) },
        }),
      },
      {
        name: "menuItemUpdate",
        doc: `mutation ($id: ID!) { menuItemUpdate(id: $id, input: { name: "x" }) { errors { code } } }`,
        vars: async () => ({ id: itemId((await seedItem()).id) }),
      },
      {
        name: "menuItemDelete",
        doc: `mutation ($id: ID!) { menuItemDelete(id: $id) { errors { code } } }`,
        vars: async () => ({ id: itemId((await seedItem()).id) }),
      },
      {
        name: "menuItemBulkDelete",
        doc: `mutation ($ids: [ID!]!) { menuItemBulkDelete(ids: $ids) { count errors { code } } }`,
        vars: async () => ({ ids: [itemId((await seedItem()).id)] }),
      },
      {
        name: "menuItemMove",
        doc: `mutation ($menu: ID!, $moves: [MenuItemMoveInput!]!) { menuItemMove(menu: $menu, moves: $moves) { errors { code } } }`,
        vars: async () => {
          const menu = await mustCreateMenu({ name: "Guarded" });
          const item = await seedItem(menu.id);
          return { menu: menuId(menu.id), moves: [{ itemId: itemId(item.id), sortOrder: 1 }] };
        },
      },
    ] as const;

  async function seedItem(menu?: string) {
    const target = menu ?? (await mustCreateMenu({ name: `Menu ${crypto.randomUUID()}` })).id;
    return mustCreateItem({ menu: target, name: "Item", url: "/" });
  }

  it("denies anonymous requests", async () => {
    for (const mutation of docs()) {
      expectPermissionDenied(await client.gql(mutation.doc, await mutation.vars()), [
        "MANAGE_MENUS",
      ]);
    }
  });

  it("denies staff without MANAGE_MENUS", async () => {
    const pages = await createStaff(db, ["MANAGE_PAGES"]);
    for (const mutation of docs()) {
      expectPermissionDenied(await client.gql(mutation.doc, await mutation.vars(), pages.token), [
        "MANAGE_MENUS",
      ]);
    }
  });

  it("allows staff with MANAGE_MENUS", async () => {
    const admin = await createStaff(db, ["MANAGE_MENUS"]);
    for (const mutation of docs()) {
      const result = await client.gql(mutation.doc, await mutation.vars(), admin.token);
      expect(result.body.errors).toBeUndefined();
    }
  });
});
