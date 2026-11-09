import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createSession } from "../identity/index.ts";
import { type CategoryCreateInput, type CategoryRow, createCategory } from "./index.ts";

// GraphQL contract tests use the real Yoga app and commerce_test database.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category CASCADE');
});

afterAll(async () => {
  await closeDb();
});

type ErrorData = { field: string | null; code: string; message: string };
type CategoryData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent: { id: string } | null;
  level: number;
  updatedAt: string;
};
type PayloadData = { category: CategoryData | null; errors: ErrorData[] };

const CATEGORY_FIELDS = `category {
  id name slug description parent { id } level updatedAt
}`;
const ERRORS = "errors { field code message }";
const CREATE = `mutation ($input: CategoryInput!, $parent: ID) {
  categoryCreate(input: $input, parent: $parent) { ${CATEGORY_FIELDS} ${ERRORS} }
}`;
const UPDATE = `mutation ($id: ID!, $input: CategoryInput!) {
  categoryUpdate(id: $id, input: $input) { ${CATEGORY_FIELDS} ${ERRORS} }
}`;
const DELETE = `mutation ($id: ID!) {
  categoryDelete(id: $id) { ${CATEGORY_FIELDS} ${ERRORS} }
}`;
const QUERY = `query ($id: ID, $slug: String) {
  category(id: $id, slug: $slug) {
    id name slug description parent { id } level updatedAt
  }
}`;

const categoryId = (id: string) => toGlobalId("Category", id);

function mutationData(result: GqlResult, field: string): PayloadData {
  const root = result.body.data as Record<string, PayloadData> | null | undefined;
  const value = root?.[field];
  if (!value) throw new Error(`Missing ${field} payload: ${JSON.stringify(result.body)}`);
  return value;
}

function category(payload: PayloadData): CategoryData {
  if (!payload.category) throw new Error("Expected a category in the payload");
  return payload.category;
}

async function mustCreate(input: CategoryCreateInput): Promise<CategoryRow> {
  const result = await createCategory(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.category;
}

describe.each([
  { name: "categoryCreate", doc: CREATE, vars: () => ({ input: { name: "Guarded" } }) },
  {
    name: "categoryUpdate",
    doc: UPDATE,
    vars: async () => ({
      id: categoryId((await mustCreate({ name: "Guarded" })).id),
      input: { name: "Changed" },
    }),
  },
  {
    name: "categoryDelete",
    doc: DELETE,
    vars: async () => ({ id: categoryId((await mustCreate({ name: "Guarded" })).id) }),
  },
])("$name requires MANAGE_PRODUCTS", ({ name, doc, vars }) => {
  it("denies anonymous requests", async () => {
    expectPermissionDenied(await client.gql(doc, await vars()), ["MANAGE_PRODUCTS"]);
  });

  it("denies a customer", async () => {
    const [customer] = await db
      .insert(schema.user)
      .values({ email: `${crypto.randomUUID()}@example.com` })
      .returning({ id: schema.user.id });
    if (!customer) throw new Error("no customer");
    const { token } = await createSession(db, customer.id);
    expectPermissionDenied(await client.gql(doc, await vars(), token), ["MANAGE_PRODUCTS"]);
  });

  it("denies staff without MANAGE_PRODUCTS", async () => {
    const { token } = await createStaff(db, ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(doc, await vars(), token), ["MANAGE_PRODUCTS"]);
  });

  it("allows staff with MANAGE_PRODUCTS", async () => {
    const { token } = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(doc, await vars(), token);
    expect(result.body.errors).toBeUndefined();
    expect(mutationData(result, name).errors).toEqual([]);
  });
});

describe("categoryCreate", () => {
  it("creates a tree with generated slugs, parent links, levels and JSON descriptions", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const description = {
      time: 1,
      blocks: [{ data: { text: "<p>Сайн байна уу?</p>" } }],
      version: "2.30.0",
    };
    const topResult = await client.gql(
      CREATE,
      {
        input: { name: "Хүүхдийн хувцас", description: JSON.stringify(description) },
      },
      admin.token,
    );
    expect(topResult.body.errors).toBeUndefined();
    const top = category(mutationData(topResult, "categoryCreate"));
    expect(top).toMatchObject({
      name: "Хүүхдийн хувцас",
      slug: "khuukhdiin-khuvtsas",
      parent: null,
      level: 0,
    });
    expect(JSON.parse(top.description ?? "")).toEqual(description);
    expect(new Date(top.updatedAt).toISOString()).toBe(top.updatedAt);

    const childResult = await client.gql(
      CREATE,
      { input: { name: "Child" }, parent: top.id },
      admin.token,
    );
    const child = category(mutationData(childResult, "categoryCreate"));
    expect(child).toMatchObject({ level: 1, parent: { id: top.id } });

    const grandchildResult = await client.gql(
      CREATE,
      { input: { name: "Grandchild" }, parent: child.id },
      admin.token,
    );
    const grandchild = category(mutationData(grandchildResult, "categoryCreate"));
    expect(grandchild).toMatchObject({ level: 2, parent: { id: child.id } });
  });

  it("returns REQUIRED, UNIQUE and INVALID ProductError values", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const create = async (input: object) =>
      mutationData(await client.gql(CREATE, { input }, admin.token), "categoryCreate");

    expect(await create({})).toEqual({
      category: null,
      errors: [{ field: "name", code: "REQUIRED", message: "This field cannot be blank." }],
    });

    await mustCreate({ name: "Existing", slug: "taken" });
    expect(await create({ name: "Other", slug: "taken" })).toMatchObject({
      category: null,
      errors: [
        {
          field: "slug",
          code: "UNIQUE",
          message: "Category with this Slug already exists.",
        },
      ],
    });

    expect(
      await create({
        name: "Invalid",
        slug: "not valid!",
        description: JSON.stringify({ blocks: "not-an-array" }),
      }),
    ).toMatchObject({
      category: null,
      errors: [
        { field: "slug", code: "INVALID" },
        { field: "description", code: "INVALID", message: "Invalid EditorJS data." },
      ],
    });
  });

  it("returns top-level errors for an unknown parent and invalid JSONString input", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const unknown = categoryId(crypto.randomUUID());
    const notFound = await client.gql(
      CREATE,
      { input: { name: "Child" }, parent: unknown },
      admin.token,
    );
    expect(notFound.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );

    const invalidJson = await client.gql(
      CREATE,
      { input: { name: "Broken", description: "{not-json" } },
      admin.token,
    );
    expect(invalidJson.body.errors?.[0]?.message).toContain("Unable to parse JSON string.");
  });
});

describe("categoryUpdate", () => {
  it("renames, changes slug and description, and advances updatedAt", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const before = await mustCreate({
      name: "Old",
      description: { blocks: [{ data: { text: "Old text" } }] },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const description = { blocks: [{ data: { text: "New text" } }] };

    const result = await client.gql(
      UPDATE,
      {
        id: categoryId(before.id),
        input: { name: "New name", slug: "new-slug", description: JSON.stringify(description) },
      },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    const updated = category(mutationData(result, "categoryUpdate"));
    expect(updated).toMatchObject({
      id: categoryId(before.id),
      name: "New name",
      slug: "new-slug",
      level: 0,
    });
    expect(JSON.parse(updated.description ?? "")).toEqual(description);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("returns validation errors and a top-level error for an unknown id", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const first = await mustCreate({ name: "First" });
    const second = await mustCreate({ name: "Second" });
    const result = await client.gql(
      UPDATE,
      {
        id: categoryId(second.id),
        input: {
          name: " ",
          slug: first.slug,
          description: JSON.stringify({ blocks: "invalid" }),
        },
      },
      admin.token,
    );
    expect(mutationData(result, "categoryUpdate")).toMatchObject({
      category: null,
      errors: [
        { field: "name", code: "REQUIRED" },
        { field: "slug", code: "UNIQUE" },
        { field: "description", code: "INVALID" },
      ],
    });

    const unknown = categoryId(crypto.randomUUID());
    const notFound = await client.gql(
      UPDATE,
      { id: unknown, input: { name: "Missing" } },
      admin.token,
    );
    expect(notFound.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
  });
});

describe("categoryDelete", () => {
  it("returns the pre-delete category and cascades through its subtree", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const parent = await mustCreate({ name: "Parent" });
    const child = await mustCreate({ name: "Child", parentId: parent.id });
    await mustCreate({ name: "Grandchild", parentId: child.id });

    const result = await client.gql(DELETE, { id: categoryId(parent.id) }, admin.token);
    expect(result.body.errors).toBeUndefined();
    expect(mutationData(result, "categoryDelete")).toMatchObject({
      category: { id: categoryId(parent.id), name: "Parent", level: 0, parent: null },
      errors: [],
    });
    expect(await db.select().from(schema.category)).toEqual([]);
  });

  it("returns a top-level error for an unknown id", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const unknown = categoryId(crypto.randomUUID());
    const result = await client.gql(DELETE, { id: unknown }, admin.token);
    expect(result.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
  });
});

describe("category query", () => {
  it("looks up a public category by id or slug and returns null for unknown values", async () => {
    const parent = await mustCreate({ name: "Parent" });
    const child = await mustCreate({ name: "Child", parentId: parent.id });

    const byId = await client.gql(QUERY, { id: categoryId(child.id) });
    expect(byId.body.errors).toBeUndefined();
    expect(byId.body.data).toMatchObject({
      category: {
        id: categoryId(child.id),
        name: "Child",
        parent: { id: categoryId(parent.id) },
        level: 1,
      },
    });

    const bySlug = await client.gql(QUERY, { slug: parent.slug });
    expect(bySlug.body.data).toMatchObject({
      category: { id: categoryId(parent.id), slug: parent.slug, level: 0 },
    });

    const unknownId = await client.gql(QUERY, { id: categoryId(crypto.randomUUID()) });
    expect(unknownId.body.data).toEqual({ category: null });
    const unknownSlug = await client.gql(QUERY, { slug: "unknown" });
    expect(unknownSlug.body.data).toEqual({ category: null });
  });

  it("requires exactly one of id and slug", async () => {
    const neither = await client.gql(QUERY);
    expect(neither.body.errors?.[0]?.message).toBe(
      "At least one of arguments is required: 'id', 'slug'.",
    );

    const both = await client.gql(QUERY, {
      id: categoryId(crypto.randomUUID()),
      slug: "catalog",
    });
    expect(both.body.errors?.[0]?.message).toBe("Argument 'id' cannot be combined with 'slug'");
  });

  it("uses Saleor's errors for malformed and wrong-type ids", async () => {
    const malformed = await client.gql(QUERY, { id: "nope" });
    expect(malformed.body.errors?.[0]?.message).toBe("Couldn't resolve id: nope.");

    const wrongType = toGlobalId("User", crypto.randomUUID());
    const result = await client.gql(QUERY, { id: wrongType });
    expect(result.body.errors?.[0]?.message).toBe(
      `Invalid ID: ${wrongType}. Expected: Category, received: User.`,
    );
  });
});
