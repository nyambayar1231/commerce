import { type Executor, schema } from "@commerce/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { slugify } from "./slug.ts";

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

async function slugTaken(db: Executor, slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(
      exceptId
        ? and(eq(schema.category.slug, slug), ne(schema.category.id, exceptId))
        : eq(schema.category.slug, slug),
    );
  return row !== undefined;
}

/** Saleor's generate_unique_slug + prepare_unique_slug. */
async function generateUniqueSlug(db: Executor, name: string): Promise<string> {
  const base = slugify(name);
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rows = await db
    .select({ slug: schema.category.slug })
    .from(schema.category)
    .where(sql`${schema.category.slug} ~* ${`^${escapedBase}(-[0-9]+)?$`}`);
  const existing = new Set(rows.map((row) => row.slug.toLowerCase()));

  if (!existing.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
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

type ParsedDescription = { value: unknown; plaintext: string };

function parseDescription(input: unknown): ParsedDescription | null {
  if (input === null) return { value: null, plaintext: "" };
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const blocks = (input as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return null;

  const parts: string[] = [];
  for (const block of blocks) {
    if (typeof block !== "object" || block === null) continue;
    const data = (block as { data?: unknown }).data;
    if (typeof data !== "object" || data === null) continue;
    const text = (data as { text?: unknown }).text;
    if (typeof text !== "string") continue;
    const part = text.replace(/<[^>]*>/g, "");
    if (part) parts.push(part);
  }
  return { value: input, plaintext: parts.join(" ").trim() };
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
      if (!invalidName) slug = await generateUniqueSlug(tx, name);
    } else {
      const invalidSlug = slugError(slug);
      if (invalidSlug) errors.push(invalidSlug);
      else if (await slugTaken(tx, slug)) {
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
        else if (await slugTaken(tx, input.slug, id)) {
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
