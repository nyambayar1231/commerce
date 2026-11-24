import { type Executor, schema } from "@commerce/db";
import { and, asc, eq, inArray, ne, type SQL, sql } from "drizzle-orm";
import { toGlobalId } from "../../graphql/globalId.ts";
import { InvalidCursorError, type OrderDirection, slugify } from "../catalog/index.ts";

// Saleor's `menu.Menu` and `menu.MenuItem` (saleor/menu/models.py). A menu is a named navigation
// tree the storefront reads by slug (`navbar`, `footer`); an item points at a URL, category,
// collection or page. Saleor stores the tree with MPTT; we keep `parent_id` and a dense
// `sort_order` per sibling group and compute `level` from the parent chain. Nesting stops at three
// levels (0, 1, 2), Paper's depth, so a create or move that would go deeper is INVALID.

export type MenuRow = typeof schema.menu.$inferSelect;
export type MenuItemRow = typeof schema.menuItem.$inferSelect;
/** A menu item with its computed depth (0 = top level), the shape GraphQL resolves. */
export type MenuItemNode = MenuItemRow & { level: number };

export const MAX_LEVEL = 2;

// Saleor's MenuErrorCode (saleor/menu/error_codes.py).
export type MenuErrorCode =
  | "CANNOT_ASSIGN_NODE"
  | "GRAPHQL_ERROR"
  | "INVALID"
  | "INVALID_MENU_ITEM"
  | "NO_MENU_ITEM_PROVIDED"
  | "NOT_FOUND"
  | "REQUIRED"
  | "TOO_MANY_MENU_ITEMS"
  | "UNIQUE";

export type MenuError = { field: string | null; code: MenuErrorCode; message: string };

export type MenuResult = { ok: true; menu: MenuRow } | { ok: false; errors: MenuError[] };

export type MenuItemResult =
  | { ok: true; menuItem: MenuItemNode }
  | { ok: false; errors: MenuError[] };

export type MenuItemMoveResult = { ok: true; menu: MenuRow } | { ok: false; errors: MenuError[] };

export type MenuItemInput = {
  name: string;
  url?: string | null;
  category?: string | null;
  collection?: string | null;
  page?: string | null;
};

export type MenuCreateInput = {
  name: string;
  slug?: string;
  items?: readonly MenuItemInput[];
};

export type MenuUpdateInput = { name?: string; slug?: string };

export type MenuItemCreateInput = MenuItemInput & {
  menu: string;
  parent?: string | null;
};

export type MenuItemUpdateInput = {
  name?: string;
  url?: string | null;
  category?: string | null;
  collection?: string | null;
  page?: string | null;
};

/** One operation of Saleor's `menuItemMove`: a relative `sortOrder` shift among the new siblings. */
export type MenuItemMove = {
  itemId: string;
  parentId: string | null;
  sortOrder: number | null;
};

const MESSAGES = {
  blank: "This field cannot be blank.",
  invalidSlug: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
  blankSlug: "Slug value cannot be blank.",
  slugTaken: "Menu with this Slug already exists.",
  invalidUrl: "Enter a valid URL.",
  noItem: "No menu item provided.",
  tooManyItems: "More than one item provided.",
  invalidMenuItem: (expected: string, received: string) =>
    `Enter a valid ${expected} ID (got ${received} ID).`,
  depth: "Menu items can be nested at most 3 levels deep.",
  self: "Cannot assign a node to itself.",
  descendant: "Cannot assign a node as child of one of its descendants.",
} as const;

/** A menu id that matches no row (the GraphQL layer maps it to `nodesNotFound`). */
export class MenuNotFoundError extends Error {
  readonly kind = "Menu";
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Menu not found: ${ids.join(", ")}`);
    this.name = "MenuNotFoundError";
    this.ids = ids;
  }
}

/** A menu item id that matches no row (the GraphQL layer maps it to `nodesNotFound`). */
export class MenuItemNotFoundError extends Error {
  readonly kind = "MenuItem";
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Menu item not found: ${ids.join(", ")}`);
    this.name = "MenuItemNotFoundError";
    this.ids = ids;
  }
}

function nameError(name: string, max: number, field: string): MenuError | null {
  if (name === "") return { field, code: "REQUIRED", message: MESSAGES.blank };
  if (name.length > max) {
    return {
      field,
      code: "INVALID",
      message: `Ensure this value has at most ${max} characters (it has ${name.length}).`,
    };
  }
  return null;
}

function slugError(slug: string): MenuError | null {
  if (slug.length > 255 || !/^[-a-zA-Z0-9_]+$/.test(slug)) {
    return { field: "slug", code: "INVALID", message: MESSAGES.invalidSlug };
  }
  return null;
}

/** Saleor's URLField: an absolute http(s) URL, or a path the storefront can link to. */
function urlError(url: string): MenuError | null {
  if (url.length > 256 || (!/^https?:\/\//i.test(url) && !url.startsWith("/"))) {
    return { field: "url", code: "INVALID", message: MESSAGES.invalidUrl };
  }
  return null;
}

const notFoundError = (field: string, type: string, id: string): MenuError => ({
  field,
  code: "NOT_FOUND",
  message: `Couldn't resolve to a node: ${toGlobalId(type, id)}`,
});

async function menuSlugTaken(db: Executor, slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.menu.id })
    .from(schema.menu)
    .where(
      exceptId
        ? and(eq(schema.menu.slug, slug), ne(schema.menu.id, exceptId))
        : eq(schema.menu.slug, slug),
    );
  return row !== undefined;
}

/** Saleor's generate_unique_slug + prepare_unique_slug, over the menu table. */
async function generateUniqueMenuSlug(db: Executor, name: string): Promise<string> {
  const base = slugify(name);
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rows = await db
    .select({ slug: schema.menu.slug })
    .from(schema.menu)
    .where(sql`${schema.menu.slug} ~* ${`^${escapedBase}(-[0-9]+)?$`}`);
  const existing = new Set(rows.map((row) => row.slug.toLowerCase()));

  if (!existing.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
}

export async function getMenu(
  db: Executor,
  where: { id: string } | { name: string } | { slug: string },
): Promise<MenuRow | null> {
  const condition =
    "id" in where
      ? eq(schema.menu.id, where.id)
      : "name" in where
        ? eq(schema.menu.name, where.name)
        : eq(schema.menu.slug, where.slug);
  const [row] = await db.select().from(schema.menu).where(condition);
  return row ?? null;
}

export async function getMenuItem(db: Executor, id: string): Promise<MenuItemRow | null> {
  const [row] = await db.select().from(schema.menuItem).where(eq(schema.menuItem.id, id));
  return row ?? null;
}

/** All of a menu's items in sibling order: `sort_order`, then id. */
export async function getMenuItems(db: Executor, menuId: string): Promise<MenuItemNode[]> {
  const rows = await db
    .select()
    .from(schema.menuItem)
    .where(eq(schema.menuItem.menuId, menuId))
    .orderBy(asc(schema.menuItem.sortOrder), asc(schema.menuItem.id));
  return withLevels(rows);
}

/** Depth (0 = top level) of each row, from the parent chain of the same result set. */
export function withLevels(rows: readonly MenuItemRow[]): MenuItemNode[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    let level = 0;
    const seen = new Set<string>();
    let current: MenuItemRow | undefined = row;
    while (current?.parentId && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      level += 1;
      current = parent;
    }
    return { ...row, level };
  });
}

/** Depth of one item, walking the parent chain in SQL (used before an insert). */
async function itemLevel(db: Executor, id: string): Promise<number> {
  const rows = await db.execute<{ level: number }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, 0 AS level FROM menu_item WHERE id = ${id}::uuid
      UNION ALL
      SELECT m.id, m.parent_id, ancestors.level + 1
      FROM menu_item AS m
      JOIN ancestors ON m.id = ancestors.parent_id
    )
    SELECT COALESCE(max(level), 0)::int AS level FROM ancestors`);
  return Number(rows[0]?.level ?? 0);
}

/** The same row with its level, for mutation payloads (2 queries, whatever the menu's size). */
async function itemNode(db: Executor, row: MenuItemRow): Promise<MenuItemNode> {
  const items = await getMenuItems(db, row.menuId);
  return items.find((item) => item.id === row.id) ?? { ...row, level: 0 };
}

type TargetField = "category" | "collection" | "page";

async function targetExists(db: Executor, field: TargetField, id: string): Promise<boolean> {
  const table = {
    category: schema.category,
    collection: schema.collection,
    page: schema.page,
  }[field];
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id));
  return row !== undefined;
}

type Targets = {
  url: string | null;
  category: string | null;
  collection: string | null;
  page: string | null;
};

const TARGET_FIELDS: readonly TargetField[] = ["category", "collection", "page"];

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Validates one item's target: at most one of url/category/collection/page, a valid URL, and an
 * existing category, collection or page. `field` is the payload field errors belong to (Saleor's
 * `items` for `menuCreate` items, the field name for `menuItemCreate`/`menuItemUpdate`).
 */
async function validateTargets(
  db: Executor,
  input: {
    url?: string | null;
    category?: string | null;
    collection?: string | null;
    page?: string | null;
  },
  field: string | null,
  { requireOne }: { requireOne: boolean },
): Promise<{ targets: Targets; errors: MenuError[] }> {
  const errors: MenuError[] = [];
  const url = input.url?.trim() ? input.url.trim() : null;
  const targets: Targets = {
    url,
    category: input.category ?? null,
    collection: input.collection ?? null,
    page: input.page ?? null,
  };

  const selected = [url, targets.category, targets.collection, targets.page].filter(
    (value) => value !== null,
  );
  if (selected.length > 1) {
    errors.push({ field, code: "TOO_MANY_MENU_ITEMS", message: MESSAGES.tooManyItems });
    return { targets, errors };
  }
  if (selected.length === 0 && requireOne) {
    errors.push({ field, code: "NO_MENU_ITEM_PROVIDED", message: MESSAGES.noItem });
  }
  if (url !== null) {
    const invalidUrl = urlError(url);
    if (invalidUrl) errors.push({ ...invalidUrl, field: field ?? "url" });
  }
  for (const targetField of TARGET_FIELDS) {
    const id = targets[targetField];
    if (id === null) continue;
    if (!(await targetExists(db, targetField, id))) {
      errors.push(notFoundError(field ?? targetField, capitalize(targetField), id));
    }
  }
  return { targets, errors };
}

export async function createMenu(db: Executor, input: MenuCreateInput): Promise<MenuResult> {
  const name = input.name.trim();

  return db.transaction(async (tx) => {
    const errors: MenuError[] = [];
    const invalidName = nameError(name, 250, "name");
    if (invalidName) errors.push(invalidName);

    let slug = input.slug;
    if (slug === undefined || slug === "") {
      if (!invalidName) slug = await generateUniqueMenuSlug(tx, name);
    } else {
      const invalidSlug = slugError(slug);
      if (invalidSlug) errors.push(invalidSlug);
      else if (await menuSlugTaken(tx, slug)) {
        errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
      }
    }

    const items: { name: string; targets: Targets }[] = [];
    for (const item of input.items ?? []) {
      const itemName = item.name.trim();
      const invalidItemName = nameError(itemName, 128, "items");
      if (invalidItemName) errors.push(invalidItemName);
      const validated = await validateTargets(tx, item, "items", { requireOne: true });
      errors.push(...validated.errors);
      items.push({ name: itemName, targets: validated.targets });
    }

    if (errors.length > 0) return { ok: false, errors };
    if (!slug) throw new Error("valid menu input produced no slug");

    const [menu] = await tx.insert(schema.menu).values({ name, slug }).returning();
    if (!menu) throw new Error("menu insert returned no row");

    if (items.length > 0) {
      await tx.insert(schema.menuItem).values(
        items.map((item, index) => ({
          menuId: menu.id,
          parentId: null,
          name: item.name,
          sortOrder: index,
          url: item.targets.url,
          categoryId: item.targets.category,
          collectionId: item.targets.collection,
          pageId: item.targets.page,
        })),
      );
    }
    return { ok: true, menu };
  });
}

export async function updateMenu(
  db: Executor,
  id: string,
  input: MenuUpdateInput,
): Promise<MenuResult> {
  return db.transaction(async (tx) => {
    const current = await getMenu(tx, { id });
    if (!current) throw new MenuNotFoundError([id]);

    const errors: MenuError[] = [];
    const values: Partial<typeof schema.menu.$inferInsert> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      const invalidName = nameError(name, 250, "name");
      if (invalidName) errors.push(invalidName);
      else values.name = name;
    }

    if (input.slug !== undefined) {
      if (input.slug === "") {
        errors.push({ field: "slug", code: "INVALID", message: MESSAGES.blankSlug });
      } else {
        const invalidSlug = slugError(input.slug);
        if (invalidSlug) errors.push(invalidSlug);
        else if (await menuSlugTaken(tx, input.slug, id)) {
          errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
        } else {
          values.slug = input.slug;
        }
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    const [menu] = await tx
      .update(schema.menu)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(schema.menu.id, id))
      .returning();
    if (!menu) throw new MenuNotFoundError([id]);
    return { ok: true, menu };
  });
}

export async function deleteMenu(db: Executor, id: string): Promise<MenuRow> {
  const [menu] = await db.delete(schema.menu).where(eq(schema.menu.id, id)).returning();
  if (!menu) throw new MenuNotFoundError([id]);
  return menu;
}

/** Deletes several menus (and their items by cascade); a duplicate id counts once. */
export async function deleteMenus(db: Executor, ids: string[]): Promise<{ count: number }> {
  const unique = [...new Set(ids)];

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: schema.menu.id })
      .from(schema.menu)
      .where(inArray(schema.menu.id, unique));
    const foundIds = new Set(found.map((row) => row.id));
    const missing = unique.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new MenuNotFoundError(missing);

    if (unique.length > 0) {
      await tx.delete(schema.menu).where(inArray(schema.menu.id, unique));
    }
    return { count: unique.length };
  });
}

/** Saleor's SortableModel.save: a new item goes last among its siblings. */
async function nextSortOrder(
  db: Executor,
  menuId: string,
  parentId: string | null,
): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${schema.menuItem.sortOrder})` })
    .from(schema.menuItem)
    .where(
      and(
        eq(schema.menuItem.menuId, menuId),
        parentId === null
          ? sql`${schema.menuItem.parentId} IS NULL`
          : eq(schema.menuItem.parentId, parentId),
      ),
    );
  return row?.max == null ? 0 : Number(row.max) + 1;
}

export async function createMenuItem(
  db: Executor,
  input: MenuItemCreateInput,
): Promise<MenuItemResult> {
  return db.transaction(async (tx) => {
    const errors: MenuError[] = [];
    const name = input.name.trim();
    const invalidName = nameError(name, 128, "name");
    if (invalidName) errors.push(invalidName);

    const menu = await getMenu(tx, { id: input.menu });
    if (!menu) errors.push(notFoundError("menu", "Menu", input.menu));

    let parent: MenuItemRow | null = null;
    if (input.parent) {
      parent = await getMenuItem(tx, input.parent);
      if (!parent) {
        errors.push(notFoundError("parent", "MenuItem", input.parent));
      } else if (parent.menuId !== input.menu) {
        errors.push({
          field: "parent",
          code: "INVALID",
          message: "Parent menu item must belong to the same menu.",
        });
      } else if ((await itemLevel(tx, parent.id)) + 1 > MAX_LEVEL) {
        errors.push({ field: "parent", code: "INVALID", message: MESSAGES.depth });
      }
    }

    const validated = await validateTargets(tx, input, null, { requireOne: false });
    errors.push(...validated.errors);

    if (errors.length > 0) return { ok: false, errors };

    const [menuItem] = await tx
      .insert(schema.menuItem)
      .values({
        menuId: input.menu,
        parentId: parent?.id ?? null,
        name,
        sortOrder: await nextSortOrder(tx, input.menu, parent?.id ?? null),
        url: validated.targets.url,
        categoryId: validated.targets.category,
        collectionId: validated.targets.collection,
        pageId: validated.targets.page,
      })
      .returning();
    if (!menuItem) throw new Error("menu item insert returned no row");
    return { ok: true, menuItem: await itemNode(tx, menuItem) };
  });
}

/**
 * Saleor's menuItemUpdate: every target is cleared first and only the input's target is set, so
 * an item never points at two things.
 */
export async function updateMenuItem(
  db: Executor,
  id: string,
  input: MenuItemUpdateInput,
): Promise<MenuItemResult> {
  return db.transaction(async (tx) => {
    const current = await getMenuItem(tx, id);
    if (!current) throw new MenuItemNotFoundError([id]);

    const errors: MenuError[] = [];
    const values: Partial<typeof schema.menuItem.$inferInsert> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      const invalidName = nameError(name, 128, "name");
      if (invalidName) errors.push(invalidName);
      else values.name = name;
    }

    const validated = await validateTargets(
      tx,
      {
        url: input.url,
        category: input.category,
        collection: input.collection,
        page: input.page,
      },
      null,
      { requireOne: false },
    );
    errors.push(...validated.errors);

    if (errors.length > 0) return { ok: false, errors };

    // A new target replaces the old one (Saleor's construct_instance clears all four). Unlike
    // Saleor, an update that names no target keeps the current one, so a rename never drops the
    // item's link (ARCHITECTURE §4).
    const targetGiven = [input.url, input.category, input.collection, input.page].some(
      (value) => value !== undefined,
    );
    if (targetGiven) {
      values.url = validated.targets.url;
      values.categoryId = validated.targets.category;
      values.collectionId = validated.targets.collection;
      values.pageId = validated.targets.page;
    }

    const [menuItem] = await tx
      .update(schema.menuItem)
      .set(values)
      .where(eq(schema.menuItem.id, id))
      .returning();
    if (!menuItem) throw new MenuItemNotFoundError([id]);
    return { ok: true, menuItem: await itemNode(tx, menuItem) };
  });
}

/** Keeps `sort_order` dense per sibling group after structural changes (Saleor's delete/move). */
async function renumberMenu(db: Executor, menuId: string): Promise<void> {
  await db.execute(sql`
    WITH ordered AS (
      SELECT id, (row_number() OVER (PARTITION BY parent_id ORDER BY sort_order, id) - 1)::int AS rn
      FROM menu_item
      WHERE menu_id = ${menuId}::uuid
    )
    UPDATE menu_item AS m
    SET sort_order = ordered.rn
    FROM ordered
    WHERE m.id = ordered.id AND m.sort_order <> ordered.rn`);
}

/** Deletes an item; its children go with it (`ON DELETE CASCADE`), siblings close the gap. */
export async function deleteMenuItem(db: Executor, id: string): Promise<MenuItemNode> {
  return db.transaction(async (tx) => {
    const current = await getMenuItem(tx, id);
    if (!current) throw new MenuItemNotFoundError([id]);
    const node = await itemNode(tx, current);

    await tx.delete(schema.menuItem).where(eq(schema.menuItem.id, id));
    await renumberMenu(tx, current.menuId);
    return node;
  });
}

/** Deletes several items (with their children); all ids must exist. */
export async function deleteMenuItems(db: Executor, ids: string[]): Promise<{ count: number }> {
  const unique = [...new Set(ids)];

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: schema.menuItem.id, menuId: schema.menuItem.menuId })
      .from(schema.menuItem)
      .where(inArray(schema.menuItem.id, unique));
    const foundIds = new Set(found.map((row) => row.id));
    const missing = unique.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new MenuItemNotFoundError(missing);

    if (unique.length > 0) {
      await tx.delete(schema.menuItem).where(inArray(schema.menuItem.id, unique));
    }
    for (const menuId of new Set(found.map((row) => row.menuId))) {
      await renumberMenu(tx, menuId);
    }
    return { count: unique.length };
  });
}

/**
 * Saleor's menuItemMove: moves items between parents and shifts them by a relative sort order,
 * all in one transaction. Operations are applied in order and see the previous ones. `sortOrder`
 * is the number of positions to shift within the (new) sibling group, as Saleor's reordering.
 */
export async function moveMenuItems(
  db: Executor,
  menuId: string,
  moves: readonly MenuItemMove[],
): Promise<MenuItemMoveResult> {
  return db.transaction(async (tx) => {
    const menu = await getMenu(tx, { id: menuId });
    if (!menu) return { ok: false, errors: [notFoundError("menu", "Menu", menuId)] };

    const rows = await tx
      .select()
      .from(schema.menuItem)
      .where(eq(schema.menuItem.menuId, menuId))
      .orderBy(asc(schema.menuItem.sortOrder), asc(schema.menuItem.id));
    const nodes = withLevels(rows);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const groups = new Map<string | null, MenuItemNode[]>();
    groups.set(null, []);
    for (const node of nodes) groups.set(node.id, []);
    for (const node of nodes) groups.get(node.parentId)?.push(node);

    const errors: MenuError[] = [];
    const parentOf = new Map(nodes.map((node) => [node.id, node.parentId]));

    const levelOf = (id: string): number => {
      let level = 0;
      let current = parentOf.get(id) ?? null;
      const seen = new Set<string>();
      while (current !== null && !seen.has(current)) {
        seen.add(current);
        level += 1;
        current = parentOf.get(current) ?? null;
      }
      return level;
    };
    const heightOf = (id: string, seen = new Set<string>()): number => {
      if (seen.has(id)) return 0;
      seen.add(id);
      let height = 0;
      for (const child of groups.get(id) ?? []) {
        height = Math.max(height, 1 + heightOf(child.id, seen));
      }
      return height;
    };
    const isDescendant = (candidateId: string, ancestorId: string): boolean => {
      let current = parentOf.get(candidateId) ?? null;
      const seen = new Set<string>();
      while (current !== null && !seen.has(current)) {
        if (current === ancestorId) return true;
        seen.add(current);
        current = parentOf.get(current) ?? null;
      }
      return false;
    };

    for (const move of moves) {
      const item = byId.get(move.itemId);
      if (!item) {
        errors.push(notFoundError("item", "MenuItem", move.itemId));
        break;
      }

      if (move.parentId !== null) {
        if (move.parentId === item.id) {
          errors.push({ field: "parentId", code: "CANNOT_ASSIGN_NODE", message: MESSAGES.self });
          break;
        }
        const newParent = byId.get(move.parentId);
        if (!newParent) {
          errors.push(notFoundError("parentId", "MenuItem", move.parentId));
          break;
        }
        if (isDescendant(newParent.id, item.id)) {
          errors.push({
            field: "parentId",
            code: "CANNOT_ASSIGN_NODE",
            message: MESSAGES.descendant,
          });
          break;
        }
        if (newParent.id !== item.parentId) {
          if (levelOf(newParent.id) + 1 + heightOf(item.id) > MAX_LEVEL) {
            errors.push({ field: "parentId", code: "INVALID", message: MESSAGES.depth });
            break;
          }
          const oldGroup = groups.get(item.parentId);
          if (oldGroup) oldGroup.splice(oldGroup.indexOf(item), 1);
          parentOf.set(item.id, newParent.id);
          item.parentId = newParent.id;
          groups.get(newParent.id)?.push(item);
        }
      } else if (item.parentId !== null) {
        const oldGroup = groups.get(item.parentId);
        if (oldGroup) oldGroup.splice(oldGroup.indexOf(item), 1);
        parentOf.set(item.id, null);
        item.parentId = null;
        groups.get(null)?.push(item);
      }

      if (move.sortOrder) {
        const group = groups.get(item.parentId);
        if (group) {
          const from = group.indexOf(item);
          const to = Math.max(0, Math.min(group.length - 1, from + move.sortOrder));
          if (from !== to) {
            group.splice(from, 1);
            group.splice(to, 0, item);
          }
        }
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    const original = new Map(rows.map((row) => [row.id, row]));
    for (const [parentId, group] of groups) {
      for (const [index, item] of group.entries()) {
        const before = original.get(item.id);
        if (before?.parentId === parentId && before.sortOrder === index) continue;
        await tx
          .update(schema.menuItem)
          .set({ parentId, sortOrder: index })
          .where(eq(schema.menuItem.id, item.id));
      }
    }
    return { ok: true, menu };
  });
}

// Saleor's `menus` connection (saleor/graphql/menu/schema.py, sorters.py): filtered, sorted,
// keyset-paginated. The cursor format and page-info rules match `collections`
// (catalog/collections.ts); sorting always tie-breaks by id.

export type MenuSortField = "NAME" | "ITEMS_COUNT";

export interface MenuListArgs {
  search?: string | null;
  /** Menu slugs; an explicitly empty list matches nothing. */
  slugs?: readonly string[] | null;
  sort?: { field: MenuSortField; direction: OrderDirection } | null;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export type MenuListRow = MenuRow & { itemsCount: number };

export interface MenuPage {
  rows: { cursor: string; node: MenuListRow }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sortValue = (row: MenuListRow, field: MenuSortField): string => {
  switch (field) {
    case "NAME":
      return row.name;
    case "ITEMS_COUNT":
      return String(row.itemsCount);
  }
};

const encodeCursor = (row: MenuListRow, field: MenuSortField): string =>
  Buffer.from(JSON.stringify([sortValue(row, field), row.id])).toString("base64");

function decodeCursor(cursor: string, field: MenuSortField): [string | number, string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== "string" ||
    typeof parsed[1] !== "string" ||
    !UUID.test(parsed[1])
  ) {
    throw new InvalidCursorError();
  }
  if (field === "ITEMS_COUNT") {
    const count = Number(parsed[0]);
    if (!Number.isInteger(count) || count < 0) throw new InvalidCursorError();
    return [count, parsed[1]];
  }
  return [parsed[0], parsed[1]];
}

type RawMenuListRow = MenuRow & { items_count: number };

export async function listMenus(db: Executor, args: MenuListArgs): Promise<MenuPage> {
  const field = args.sort?.field ?? "NAME";
  const direction = args.sort?.direction ?? "ASC";
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;

  const filters: SQL[] = [];
  if (args.search?.trim()) {
    const pattern = `%${args.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(sql`(m.name ILIKE ${pattern} OR m.slug ILIKE ${pattern})`);
  }
  if (args.slugs != null) {
    filters.push(
      args.slugs.length === 0
        ? sql`FALSE`
        : sql`m.slug IN (${sql.join(
            args.slugs.map((slug) => sql`${slug}`),
            sql`, `,
          )})`,
    );
  }
  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

  const sortColumn: SQL = {
    NAME: sql`name`,
    ITEMS_COUNT: sql`items_count`,
  }[field];
  const ascending = (direction === "ASC") !== backwards;
  const order = ascending ? sql`ASC` : sql`DESC`;
  let keyset = sql``;
  if (cursor) {
    const [value, id] = decodeCursor(cursor, field);
    keyset = ascending
      ? sql`WHERE (${sortColumn}, id) > (${value}, ${id}::uuid)`
      : sql`WHERE (${sortColumn}, id) < (${value}, ${id}::uuid)`;
  }

  const base = sql`
    WITH base AS (
      SELECT
        m.id, m.name, m.slug, m.created_at AS "createdAt", m.updated_at AS "updatedAt",
        (SELECT count(*) FROM menu_item AS mi WHERE mi.menu_id = m.id)::int AS items_count
      FROM menu AS m
      ${where}
    )`;

  const [menuRows, [{ count } = { count: 0 }]] = await Promise.all([
    db.execute<RawMenuListRow>(sql`
      ${base}
      SELECT * FROM base ${keyset}
      ORDER BY ${sortColumn} ${order}, id ${order}
      LIMIT ${limit + 1}`),
    db.execute<{ count: number }>(sql`${base} SELECT count(*)::int AS count FROM base`),
  ]);

  const rows = [...menuRows].map(({ items_count, ...row }) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    itemsCount: items_count,
  }));
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (backwards) page.reverse();

  return {
    rows: page.map((node) => ({ cursor: encodeCursor(node, field), node })),
    hasNextPage: backwards ? Boolean(cursor) : hasMore,
    hasPreviousPage: backwards ? hasMore : Boolean(cursor),
    totalCount: count,
  };
}
