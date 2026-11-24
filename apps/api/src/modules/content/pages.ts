import { type Executor, schema } from "@commerce/db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { parseDescription, slugify } from "../catalog/index.ts";

// Saleor's `page.Page` (saleor/page/models.py): staff-written content ("About us", "Shipping and
// returns") the storefront shows at /pages/{slug}. Page types and attributes are not modelled
// (ARCHITECTURE.md §4 deviations), so a page is just a title, a slug, rich content and its
// publication. Visibility is the same single-channel rule as collections (ADR-0005): published,
// and not scheduled for later.

export type PageRow = typeof schema.page.$inferSelect;

// Saleor's PageErrorCode (saleor/page/error_codes.py), minus the attribute codes we can't produce.
export type PageErrorCode = "GRAPHQL_ERROR" | "INVALID" | "NOT_FOUND" | "REQUIRED" | "UNIQUE";

export type PageError = {
  field: string | null;
  code: PageErrorCode;
  message: string;
};

export type PageResult = { ok: true; page: PageRow } | { ok: false; errors: PageError[] };

export type PageCreateInput = {
  title: string;
  slug?: string;
  content?: unknown;
  isPublished?: boolean;
};

export type PageUpdateInput = {
  title?: string;
  slug?: string;
  content?: unknown;
  isPublished?: boolean;
};

const MESSAGES = {
  blank: "This field cannot be blank.",
  invalidSlug: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
  blankSlug: "Slug value cannot be blank.",
  slugTaken: "Page with this Slug already exists.",
  invalidContent: "Invalid EditorJS data.",
} as const;

/** A page id that matches no row (the GraphQL layer maps it to `nodesNotFound`). */
export class PageNotFoundError extends Error {
  readonly kind = "Page";
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Page not found: ${ids.join(", ")}`);
    this.name = "PageNotFoundError";
    this.ids = ids;
  }
}

function titleError(title: string): PageError | null {
  if (title === "") return { field: "title", code: "REQUIRED", message: MESSAGES.blank };
  if (title.length > 250) {
    return {
      field: "title",
      code: "INVALID",
      message: `Ensure this value has at most 250 characters (it has ${title.length}).`,
    };
  }
  return null;
}

function slugError(slug: string): PageError | null {
  if (slug.length > 255 || !/^[-a-zA-Z0-9_]+$/.test(slug)) {
    return { field: "slug", code: "INVALID", message: MESSAGES.invalidSlug };
  }
  return null;
}

// The slug queries catalog's `slug.ts` does for categories, products and collections, for the
// page table: catalog may not know this module's table, so the two small queries live here and
// only `slugify` (Saleor's transliterating slugifier) is shared.

async function pageSlugTaken(db: Executor, slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.page.id })
    .from(schema.page)
    .where(
      exceptId
        ? and(eq(schema.page.slug, slug), ne(schema.page.id, exceptId))
        : eq(schema.page.slug, slug),
    );
  return row !== undefined;
}

/** Saleor's generate_unique_slug + prepare_unique_slug, over the page table. */
async function generateUniqueSlug(db: Executor, title: string): Promise<string> {
  const base = slugify(title);
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rows = await db
    .select({ slug: schema.page.slug })
    .from(schema.page)
    .where(sql`${schema.page.slug} ~* ${`^${escapedBase}(-[0-9]+)?$`}`);
  const existing = new Set(rows.map((row) => row.slug.toLowerCase()));

  if (!existing.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
}

/**
 * A page's visibility to the public: published, and not scheduled for later. The same rule as
 * `isCollectionPublished`; staff with MANAGE_PAGES see every page.
 */
export function isPagePublished(page: PageRow): boolean {
  return (
    page.isPublished && (page.publishedAt === null || page.publishedAt.getTime() <= Date.now())
  );
}

export async function getPage(
  db: Executor,
  where: { id: string } | { slug: string },
): Promise<PageRow | null> {
  const condition = "id" in where ? eq(schema.page.id, where.id) : eq(schema.page.slug, where.slug);
  const [row] = await db.select().from(schema.page).where(condition);
  return row ?? null;
}

export async function createPage(db: Executor, input: PageCreateInput): Promise<PageResult> {
  const title = input.title.trim();

  return db.transaction(async (tx) => {
    const errors: PageError[] = [];
    const invalidTitle = titleError(title);
    if (invalidTitle) errors.push(invalidTitle);

    let slug = input.slug;
    if (slug === undefined || slug === "") {
      if (!invalidTitle) slug = await generateUniqueSlug(tx, title);
    } else {
      const invalidSlug = slugError(slug);
      if (invalidSlug) errors.push(invalidSlug);
      else if (await pageSlugTaken(tx, slug)) {
        errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
      }
    }

    let content: unknown = null;
    let contentPlaintext = "";
    if (input.content !== undefined) {
      const parsed = parseDescription(input.content);
      if (!parsed) {
        errors.push({ field: "content", code: "INVALID", message: MESSAGES.invalidContent });
      } else {
        content = parsed.value;
        contentPlaintext = parsed.plaintext;
      }
    }

    if (errors.length > 0) return { ok: false, errors };
    if (!slug) throw new Error("valid page input produced no slug");

    const isPublished = input.isPublished ?? false;
    const [page] = await tx
      .insert(schema.page)
      .values({
        title,
        slug,
        content,
        contentPlaintext,
        isPublished,
        publishedAt: isPublished ? sql`now()` : null,
      })
      .returning();
    if (!page) throw new Error("page insert returned no row");
    return { ok: true, page };
  });
}

export async function updatePage(
  db: Executor,
  id: string,
  input: PageUpdateInput,
): Promise<PageResult> {
  return db.transaction(async (tx) => {
    const current = await getPage(tx, { id });
    if (!current) throw new PageNotFoundError([id]);

    const errors: PageError[] = [];
    const values: Partial<typeof schema.page.$inferInsert> = {};

    if (input.title !== undefined) {
      const title = input.title.trim();
      const invalidTitle = titleError(title);
      if (invalidTitle) errors.push(invalidTitle);
      else values.title = title;
    }

    if (input.slug !== undefined) {
      if (input.slug === "") {
        errors.push({ field: "slug", code: "INVALID", message: MESSAGES.blankSlug });
      } else {
        const invalidSlug = slugError(input.slug);
        if (invalidSlug) errors.push(invalidSlug);
        else if (await pageSlugTaken(tx, input.slug, id)) {
          errors.push({ field: "slug", code: "UNIQUE", message: MESSAGES.slugTaken });
        } else {
          values.slug = input.slug;
        }
      }
    }

    if (input.content !== undefined) {
      const parsed = parseDescription(input.content);
      if (!parsed) {
        errors.push({ field: "content", code: "INVALID", message: MESSAGES.invalidContent });
      } else {
        values.content = parsed.value;
        values.contentPlaintext = parsed.plaintext;
      }
    }

    // Saleor's publish rules, as collections: a first publication stamps published_at, and
    // unpublishing clears it so the next publication stamps a new date.
    const isPublished = input.isPublished ?? current.isPublished;
    if (input.isPublished !== undefined) values.isPublished = isPublished;
    if (isPublished && !current.isPublished) values.publishedAt = new Date();
    if (!isPublished) values.publishedAt = null;

    if (errors.length > 0) return { ok: false, errors };

    const [page] = await tx
      .update(schema.page)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(schema.page.id, id))
      .returning();
    if (!page) throw new PageNotFoundError([id]);
    return { ok: true, page };
  });
}

export async function deletePage(db: Executor, id: string): Promise<PageRow> {
  const [page] = await db.delete(schema.page).where(eq(schema.page.id, id)).returning();
  if (!page) throw new PageNotFoundError([id]);
  return page;
}

/**
 * Deletes several pages at once (Saleor's pageBulkDelete). All ids must exist, as Saleor's
 * get_nodes_or_error; `count` is how many of the given pages were deleted (a duplicate id is
 * counted once).
 */
export async function deletePages(db: Executor, ids: string[]): Promise<{ count: number }> {
  const unique = [...new Set(ids)];

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: schema.page.id })
      .from(schema.page)
      .where(inArray(schema.page.id, unique));
    const foundIds = new Set(found.map((row) => row.id));
    const missing = unique.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new PageNotFoundError(missing);

    if (unique.length > 0) {
      await tx.delete(schema.page).where(inArray(schema.page.id, unique));
    }
    return { count: unique.length };
  });
}
