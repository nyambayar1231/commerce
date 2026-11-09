import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  type CategoryCreateInput,
  type CategoryResult,
  type CategoryRow,
  type CategoryUpdateInput,
  createCategory,
  deleteCategory,
  NotFoundError,
  updateCategory,
} from "./index.ts";

// Domain tests use the real (test) database.
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE category CASCADE");
});

afterAll(async () => {
  await closeDb();
});

async function mustCreate(input: CategoryCreateInput): Promise<CategoryRow> {
  const result = await createCategory(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.category;
}

async function mustUpdate(id: string, input: CategoryUpdateInput): Promise<CategoryRow> {
  const result = await updateCategory(db, id, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.category;
}

function expectFailure(result: CategoryResult) {
  if (result.ok) throw new Error("expected category validation to fail");
  return result.errors;
}

describe("createCategory", () => {
  it("creates top-level and child categories with EditorJS plaintext", async () => {
    const description = {
      time: 1,
      blocks: [
        { data: { text: "<p>Hello <strong>world</strong></p>" } },
        { data: { text: "Second block" } },
      ],
      version: "2.30.0",
    };
    const parent = await mustCreate({ name: "  Catalog  ", description });
    const child = await mustCreate({ name: "Shoes", parentId: parent.id });

    expect(parent).toMatchObject({
      name: "Catalog",
      slug: "catalog",
      description,
      descriptionPlaintext: "Hello world Second block",
      parentId: null,
    });
    expect(child).toMatchObject({ name: "Shoes", slug: "shoes", parentId: parent.id });
    expect(child.description).toBeNull();
    expect(child.descriptionPlaintext).toBe("");
  });

  it("generates the first free -2, -3, … suffix", async () => {
    const first = await mustCreate({ name: "Gift Cards" });
    const second = await mustCreate({ name: "Gift Cards" });
    const third = await mustCreate({ name: "Gift Cards" });

    expect([first.slug, second.slug, third.slug]).toEqual([
      "gift-cards",
      "gift-cards-2",
      "gift-cards-3",
    ]);
  });

  it("matches existing slugs case-insensitively when generating a suffix", async () => {
    await mustCreate({ name: "Existing", slug: "GIFT-CARDS" });
    const generated = await mustCreate({ name: "Gift Cards" });
    expect(generated.slug).toBe("gift-cards-2");
  });

  it("accepts a given slug and reports a taken slug without writing", async () => {
    await mustCreate({ name: "Summer", slug: "Summer_Sale-2026" });

    const result = await createCategory(db, { name: "Other", slug: "Summer_Sale-2026" });
    expect(expectFailure(result)).toEqual([
      {
        field: "slug",
        code: "UNIQUE",
        message: "Category with this Slug already exists.",
      },
    ]);
    expect(await db.select().from(schema.category)).toHaveLength(1);
  });

  it.each(["not valid!", "x".repeat(256)])("rejects invalid slug %s", async (slug) => {
    const result = await createCategory(db, { name: "Catalog", slug });
    expect(expectFailure(result)).toEqual([
      {
        field: "slug",
        code: "INVALID",
        message: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
      },
    ]);
    expect(await db.select().from(schema.category)).toEqual([]);
  });

  it("collects validation errors and writes nothing", async () => {
    const blank = await createCategory(db, {
      name: "   ",
      slug: "not valid!",
      description: { blocks: "not-an-array" },
    });
    expect(expectFailure(blank)).toEqual([
      { field: "name", code: "REQUIRED", message: "This field cannot be blank." },
      {
        field: "slug",
        code: "INVALID",
        message: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
      },
      { field: "description", code: "INVALID", message: "Invalid EditorJS data." },
    ]);

    const tooLong = await createCategory(db, { name: "x".repeat(251) });
    expect(expectFailure(tooLong)).toEqual([
      {
        field: "name",
        code: "INVALID",
        message: "Ensure this value has at most 250 characters (it has 251).",
      },
    ]);
    expect(await db.select().from(schema.category)).toEqual([]);
  });

  it("throws NotFoundError for an unknown parent", async () => {
    const parentId = crypto.randomUUID();
    const pending = createCategory(db, { name: "Child", parentId });
    await expect(pending).rejects.toBeInstanceOf(NotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Category", ids: [parentId] });
    expect(await db.select().from(schema.category)).toEqual([]);
  });
});

describe("updateCategory", () => {
  it("updates name, slug and description and recomputes plaintext and updated_at", async () => {
    const before = await mustCreate({
      name: "Old",
      description: { blocks: [{ data: { text: "Old text" } }] },
    });
    await new Promise((resolve) => setTimeout(resolve, 2));

    const after = await mustUpdate(before.id, {
      name: "  New name  ",
      slug: "new-slug",
      description: {
        blocks: [
          { data: { text: "<p>Updated <em>copy</em></p>" } },
          { data: { text: "More text" } },
        ],
      },
    });

    expect(after).toMatchObject({
      id: before.id,
      name: "New name",
      slug: "new-slug",
      descriptionPlaintext: "Updated copy More text",
    });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("rejects a blank slug and invalid description without changing the row", async () => {
    const before = await mustCreate({ name: "Catalog", description: null });
    const result = await updateCategory(db, before.id, {
      slug: "",
      description: { blocks: 42 },
    });

    expect(expectFailure(result)).toEqual([
      { field: "slug", code: "INVALID", message: "Slug value cannot be blank." },
      { field: "description", code: "INVALID", message: "Invalid EditorJS data." },
    ]);
    const [unchanged] = await db
      .select()
      .from(schema.category)
      .where(eq(schema.category.id, before.id));
    expect(unchanged).toEqual(before);
  });

  it("keeps the slug when it is absent and clears a null description", async () => {
    const before = await mustCreate({
      name: "Catalog",
      description: { blocks: [{ data: { text: "Text" } }] },
    });
    const renamed = await mustUpdate(before.id, { name: "Renamed" });
    expect(renamed.slug).toBe(before.slug);

    const cleared = await mustUpdate(before.id, { description: null });
    expect(cleared.slug).toBe(before.slug);
    expect(cleared.description).toBeNull();
    expect(cleared.descriptionPlaintext).toBe("");
  });

  it("checks a given slug for uniqueness while allowing the category's own slug", async () => {
    const first = await mustCreate({ name: "First" });
    const second = await mustCreate({ name: "Second" });

    const taken = await updateCategory(db, second.id, { slug: first.slug });
    expect(expectFailure(taken)).toEqual([
      {
        field: "slug",
        code: "UNIQUE",
        message: "Category with this Slug already exists.",
      },
    ]);
    expect((await mustUpdate(second.id, { slug: second.slug })).slug).toBe(second.slug);
  });

  it("throws NotFoundError for an unknown id", async () => {
    const id = crypto.randomUUID();
    const pending = updateCategory(db, id, { name: "New" });
    await expect(pending).rejects.toBeInstanceOf(NotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Category", ids: [id] });
  });
});

describe("deleteCategory", () => {
  it("returns the deleted id and cascades through the subtree", async () => {
    const parent = await mustCreate({ name: "Parent" });
    const child = await mustCreate({ name: "Child", parentId: parent.id });
    await mustCreate({ name: "Grandchild", parentId: child.id });

    await expect(deleteCategory(db, parent.id)).resolves.toEqual({ id: parent.id });
    expect(await db.select().from(schema.category)).toEqual([]);
  });

  it("throws NotFoundError for an unknown id", async () => {
    const id = crypto.randomUUID();
    const pending = deleteCategory(db, id);
    await expect(pending).rejects.toBeInstanceOf(NotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Category", ids: [id] });
  });
});
