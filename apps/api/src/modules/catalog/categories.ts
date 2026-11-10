import { type Executor, schema } from "@commerce/db";
import { eq, inArray, sql } from "drizzle-orm";
import { parseDescription } from "./description.ts";
import { generateUniqueSlug, slugTaken } from "./slug.ts";

export type CategoryRow = typeof schema.category.$inferSelect;

export type CategoryError = {
  field: string | null;
  code: "REQUIRED" | "UNIQUE" | "INVALID";
  message: string;
};

export type CategoryResult =
  | { ok: true; category: CategoryRow }
  | { ok: false; errors: CategoryError[] };

export type CategoryCreateInput = {
  name: string;
  slug?: string;
  description?: unknown;
  parentId?: string;
};

export type CategoryUpdateInput = {
  name?: string;
  slug?: string;
  description?: unknown;
};

const MESSAGES = {
  blank: "This field cannot be blank.",
  invalidSlug: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
  blankSlug: "Slug value cannot be blank.",
  slugTaken: "Category with this Slug already exists.",
  invalidDescription: "Invalid EditorJS data.",
} as const;

/** A category id (or parent id) that matches no row. */
export class NotFoundError extends Error {
  readonly kind = "Category";
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Category not found: ${ids.join(", ")}`);
    this.name = "NotFoundError";
    this.ids = ids;
  }
}

function nameError(name: string): CategoryError | null {
  if (name === "") return { field: "name", code: "REQUIRED", message: MESSAGES.blank };
  if (name.length > 250) {
    return {
      field: "name",
      code: "INVALID",
      message: `Ensure this value has at most 250 characters (it has ${name.length}).`,
    };
  }
  return null;
}

function slugError(slug: string): CategoryError | null {
  if (slug.length > 255 || !/^[-a-zA-Z0-9_]+$/.test(slug)) {
    return { field: "slug", code: "INVALID", message: MESSAGES.invalidSlug };
  }
  return null;
}

export async function getCategory(
  db: Executor,
  where: { id: string } | { slug: string },
): Promise<CategoryRow | null> {
  const condition =
    "id" in where ? eq(schema.category.id, where.id) : eq(schema.category.slug, where.slug);
  const [row] = await db.select().from(schema.category).where(condition);
  return row ?? null;
}

async function requireCategory(db: Executor, id: string): Promise<CategoryRow> {
  const row = await getCategory(db, { id });
  if (!row) throw new NotFoundError([id]);
  return row;
}

/** Zero-based depth in the category tree, following parent_id up to the root. */
export async function getCategoryLevel(db: Executor, id: string): Promise<number> {
  const rows = await db.execute<{ level: number }>(sql`
    WITH RECURSIVE category_tree AS (
      SELECT id, parent_id, 0 AS level
      FROM category
      WHERE id = ${id}
      UNION ALL
      SELECT parent.id, parent.parent_id, category_tree.level + 1
      FROM category AS parent
      INNER JOIN category_tree ON parent.id = category_tree.parent_id
    )
    SELECT level
    FROM category_tree
    ORDER BY level DESC
    LIMIT 1
  `);
  return rows[0]?.level ?? 0;
}

export async function createCategory(
  db: Executor,
  input: CategoryCreateInput,
): Promise<CategoryResult> {
  const name = input.name.trim();

  return db.transaction(async (tx) => {
    const errors: CategoryError[] = [];
    const invalidName = nameError(name);
    if (invalidName) errors.push(invalidName);

    let slug = input.slug;
    if (slug === undefined || slug === "") {
      if (!invalidName) slug = await generateUniqueSlug(tx, schema.category, name);
    } else {
      const invalidSlug = slugError(slug);
      if (invalidSlug) errors.push(invalidSlug);
      else if (await slugTaken(tx, schema.category, slug)) {
        errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
      }
    }

    let description: unknown = null;
    let descriptionPlaintext = "";
    if (input.description !== undefined) {
      const parsed = parseDescription(input.description);
      if (!parsed) {
        errors.push({
          field: "description",
          code: "INVALID",
          message: MESSAGES.invalidDescription,
        });
      } else {
        description = parsed.value;
        descriptionPlaintext = parsed.plaintext;
      }
    }

    if (input.parentId !== undefined) await requireCategory(tx, input.parentId);
    if (errors.length > 0) return { ok: false, errors };
    if (!slug) throw new Error("valid category input produced no slug");

    const [category] = await tx
      .insert(schema.category)
      .values({
        name,
        slug,
        description,
        descriptionPlaintext,
        parentId: input.parentId,
      })
      .returning();
    if (!category) throw new Error("category insert returned no row");
    return { ok: true, category };
  });
}

export async function updateCategory(
  db: Executor,
  id: string,
  input: CategoryUpdateInput,
): Promise<CategoryResult> {
  return db.transaction(async (tx) => {
    await requireCategory(tx, id);
    const errors: CategoryError[] = [];
    const values: Partial<typeof schema.category.$inferInsert> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      const invalidName = nameError(name);
      if (invalidName) errors.push(invalidName);
      else values.name = name;
    }

    if (input.slug !== undefined) {
      if (input.slug === "") {
        errors.push({ field: "slug", code: "INVALID", message: MESSAGES.blankSlug });
      } else {
        const invalidSlug = slugError(input.slug);
        if (invalidSlug) errors.push(invalidSlug);
        else if (await slugTaken(tx, schema.category, input.slug, id)) {
          errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
        } else {
          values.slug = input.slug;
        }
      }
    }

    if (input.description !== undefined) {
      const parsed = parseDescription(input.description);
      if (!parsed) {
        errors.push({
          field: "description",
          code: "INVALID",
          message: MESSAGES.invalidDescription,
        });
      } else {
        values.description = parsed.value;
        values.descriptionPlaintext = parsed.plaintext;
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    const [category] = await tx
      .update(schema.category)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(schema.category.id, id))
      .returning();
    if (!category) throw new NotFoundError([id]);
    return { ok: true, category };
  });
}

export async function deleteCategory(db: Executor, id: string): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [category] = await tx
      .delete(schema.category)
      .where(eq(schema.category.id, id))
      .returning({ id: schema.category.id });
    if (!category) throw new NotFoundError([id]);
    return category;
  });
}

/**
 * Deletes several categories at once (Saleor's categoryBulkDelete); their subtrees go with them
 * (FK cascade). All ids must exist, as Saleor's get_nodes_or_error; `count` is how many of the
 * given categories were deleted (a child listed next to its parent is counted once, as deleted).
 */
export async function deleteCategories(db: Executor, ids: string[]): Promise<{ count: number }> {
  const unique = [...new Set(ids)];

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: schema.category.id })
      .from(schema.category)
      .where(inArray(schema.category.id, unique));
    const missing = unique.filter((id) => !found.some((row) => row.id === id));
    if (missing.length > 0) throw new NotFoundError(missing);

    if (unique.length > 0) {
      await tx.delete(schema.category).where(inArray(schema.category.id, unique));
    }
    return { count: unique.length };
  });
}
