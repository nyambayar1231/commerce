import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createSession } from "../identity/index.ts";
import {
  addCollectionProducts,
  type CollectionCreateInput,
  CollectionNotFoundError,
  type CollectionResult,
  type CollectionRow,
  createCollection,
  deleteCollection,
  deleteCollections,
  getCollection,
  InvalidCursorError,
  listCollections,
  removeCollectionProducts,
  updateCollection,
} from "./index.ts";

// Domain and GraphQL contract tests for Saleor's collections (M15.4a), against the real (test)
// database and the real Yoga app.
const db = getDb();
const client = createTestClient(db);

const BOOTS = "00000000-0000-4000-8000-000000000001";
const SHOES = "00000000-0000-4000-8000-000000000002";
const HATS = "00000000-0000-4000-8000-000000000003";

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, category, collection, product CASCADE',
  );
  await db.insert(schema.product).values([
    { id: BOOTS, name: "Boots", slug: "boots" },
    { id: SHOES, name: "Shoes", slug: "shoes" },
    { id: HATS, name: "Hats", slug: "hats" },
  ]);
});

afterAll(async () => {
  await closeDb();
});

async function mustCreate(input: CollectionCreateInput): Promise<CollectionRow> {
  const result = await createCollection(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.collection;
}

function expectFailure(result: CollectionResult) {
  if (result.ok) throw new Error("expected collection validation to fail");
  return result.errors;
}

/** The linked product ids, in id order, so assertions ignore link order. */
const linkedProducts = async () =>
  (
    await db
      .select({ productId: schema.collectionProduct.productId })
      .from(schema.collectionProduct)
  )
    .map((row) => row.productId)
    .sort();

const collectionNames = (page: { rows: { node: CollectionRow }[] }) =>
  page.rows.map((row) => row.node.name);

const schedule = (id: string, publishedAt: Date) =>
  db.update(schema.collection).set({ publishedAt }).where(eq(schema.collection.id, id));

describe("createCollection", () => {
  it("creates an unpublished collection with a generated slug and EditorJS plaintext", async () => {
    const description = {
      time: 1,
      blocks: [
        { data: { text: "<p>Summer <strong>sale</strong></p>" } },
        { data: { text: "Second block" } },
      ],
      version: "2.30.0",
    };
    const collection = await mustCreate({ name: "  Summer Sale  ", description });

    expect(collection).toMatchObject({
      name: "Summer Sale",
      slug: "summer-sale",
      description,
      descriptionPlaintext: "Summer sale Second block",
      isPublished: false,
      publishedAt: null,
    });
  });

  it("stamps publishedAt when created published", async () => {
    const collection = await mustCreate({ name: "Featured", isPublished: true });

    expect(collection.isPublished).toBe(true);
    expect(collection.publishedAt).toBeInstanceOf(Date);
  });

  it("generates the first free suffix and matches existing slugs case-insensitively", async () => {
    await mustCreate({ name: "Gift Cards", slug: "GIFT-CARDS" });
    const second = await mustCreate({ name: "Gift Cards" });
    const third = await mustCreate({ name: "Gift Cards" });

    expect([second.slug, third.slug]).toEqual(["gift-cards-2", "gift-cards-3"]);
  });

  it("reports a taken or invalid slug and a blank name without writing", async () => {
    await mustCreate({ name: "Existing", slug: "taken" });

    const taken = await createCollection(db, { name: "Other", slug: "taken" });
    expect(expectFailure(taken)).toEqual([
      { field: "slug", code: "UNIQUE", message: "Collection with this Slug already exists." },
    ]);

    const blank = await createCollection(db, {
      name: "  ",
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

    expect(await db.select().from(schema.collection)).toHaveLength(1);
  });

  it("links products once and reports unknown ones without writing", async () => {
    const collection = await mustCreate({
      name: "Featured",
      products: [BOOTS, SHOES, BOOTS],
    });
    expect(await linkedProducts()).toEqual([BOOTS, SHOES].sort());
    expect(collection.id).toBeTruthy();

    const missing = crypto.randomUUID();
    const result = await createCollection(db, { name: "Other", products: [BOOTS, missing] });
    expect(expectFailure(result)).toEqual([
      {
        field: "products",
        code: "NOT_FOUND",
        message: `Couldn't resolve to a node: ${toGlobalId("Product", missing)}.`,
      },
    ]);
    expect(await db.select().from(schema.collection)).toHaveLength(1);
  });
});

describe("getCollection and updateCollection", () => {
  it("finds a collection by id or slug and returns null for an unknown one", async () => {
    const collection = await mustCreate({ name: "Catalog" });

    await expect(getCollection(db, { id: collection.id })).resolves.toEqual(collection);
    await expect(getCollection(db, { slug: collection.slug })).resolves.toEqual(collection);
    await expect(getCollection(db, { id: crypto.randomUUID() })).resolves.toBeNull();
    await expect(getCollection(db, { slug: "unknown" })).resolves.toBeNull();
  });

  it("updates only the given fields and advances updatedAt", async () => {
    const before = await mustCreate({ name: "Old", description: { blocks: [] } });
    await new Promise((resolve) => setTimeout(resolve, 2));

    const result = await updateCollection(db, before.id, { name: "  New  " });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    expect(result.collection).toMatchObject({
      id: before.id,
      name: "New",
      slug: before.slug,
      description: { blocks: [] },
    });
    expect(result.collection.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("stamps publishedAt on the first publication only and clears it when unpublished", async () => {
    const collection = await mustCreate({ name: "Draft" });

    const published = await updateCollection(db, collection.id, { isPublished: true });
    if (!published.ok) throw new Error(JSON.stringify(published.errors));
    const firstPublishedAt = published.collection.publishedAt;
    expect(firstPublishedAt).toBeInstanceOf(Date);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const again = await updateCollection(db, collection.id, { isPublished: true, name: "Live" });
    if (!again.ok) throw new Error(JSON.stringify(again.errors));
    expect(again.collection.publishedAt).toEqual(firstPublishedAt);

    const unpublished = await updateCollection(db, collection.id, { isPublished: false });
    if (!unpublished.ok) throw new Error(JSON.stringify(unpublished.errors));
    expect(unpublished.collection.publishedAt).toBeNull();

    const republished = await updateCollection(db, collection.id, { isPublished: true });
    if (!republished.ok) throw new Error(JSON.stringify(republished.errors));
    expect(republished.collection.publishedAt?.getTime()).toBeGreaterThan(
      firstPublishedAt?.getTime() ?? 0,
    );
  });

  it("rejects a taken slug and an invalid description without changing the row", async () => {
    const first = await mustCreate({ name: "First" });
    const second = await mustCreate({
      name: "Second",
      description: { blocks: [{ data: { text: "Text" } }] },
    });

    const result = await updateCollection(db, second.id, {
      slug: first.slug,
      description: { blocks: 42 },
    });
    expect(expectFailure(result)).toEqual([
      { field: "slug", code: "UNIQUE", message: "Collection with this Slug already exists." },
      { field: "description", code: "INVALID", message: "Invalid EditorJS data." },
    ]);

    const unchanged = await db
      .select()
      .from(schema.collection)
      .where(eq(schema.collection.id, second.id));
    expect(unchanged[0]?.descriptionPlaintext).toBe("Text");
  });

  it("throws CollectionNotFoundError for an unknown id", async () => {
    const id = crypto.randomUUID();
    const pending = updateCollection(db, id, { name: "New" });

    await expect(pending).rejects.toBeInstanceOf(CollectionNotFoundError);
    await expect(pending).rejects.toMatchObject({ kind: "Collection", ids: [id] });
  });
});

describe("deleteCollection and deleteCollections", () => {
  it("deletes a collection, keeping its products and removing only the links", async () => {
    const collection = await mustCreate({ name: "Featured", products: [BOOTS, SHOES] });

    await expect(deleteCollection(db, collection.id)).resolves.toEqual(collection);
    expect(await db.select().from(schema.collection)).toEqual([]);
    expect(await linkedProducts()).toEqual([]);
    expect(await db.select({ id: schema.product.id }).from(schema.product)).toHaveLength(3);
  });

  it("bulk deletes, counting duplicates once and leaving the products", async () => {
    const first = await mustCreate({ name: "First", products: [BOOTS] });
    await mustCreate({ name: "Second", products: [SHOES] });
    await mustCreate({ name: "Third" });

    await expect(deleteCollections(db, [first.id, first.id, first.id])).resolves.toEqual({
      count: 1,
    });
    expect((await db.select().from(schema.collection)).map((row) => row.name).sort()).toEqual([
      "Second",
      "Third",
    ]);
    expect(await linkedProducts()).toEqual([SHOES]);

    await expect(deleteCollections(db, [])).resolves.toEqual({ count: 0 });
  });

  it("refuses unknown ids and deletes nothing", async () => {
    const collection = await mustCreate({ name: "Kept" });
    const id = crypto.randomUUID();
    const pending = deleteCollections(db, [collection.id, id]);

    await expect(pending).rejects.toBeInstanceOf(CollectionNotFoundError);
    await expect(pending).rejects.toMatchObject({ ids: [id] });
    expect(await db.select().from(schema.collection)).toHaveLength(1);
  });

  it("removes a product's links when the product is deleted (cascade)", async () => {
    const collection = await mustCreate({ name: "Featured", products: [BOOTS, SHOES] });

    await db.delete(schema.product).where(eq(schema.product.id, BOOTS));

    expect(await linkedProducts()).toEqual([SHOES]);
    expect(await getCollection(db, { id: collection.id })).not.toBeNull();
  });
});

describe("addCollectionProducts and removeCollectionProducts", () => {
  it("adds products idempotently and bumps updatedAt", async () => {
    const collection = await mustCreate({ name: "Featured" });
    await new Promise((resolve) => setTimeout(resolve, 2));

    const first = await addCollectionProducts(db, collection.id, [BOOTS, SHOES, BOOTS]);
    if (!first.ok) throw new Error(JSON.stringify(first.errors));
    expect(first.collection.updatedAt.getTime()).toBeGreaterThan(collection.updatedAt.getTime());
    expect(await linkedProducts()).toEqual([BOOTS, SHOES].sort());

    const before = first.collection;
    await new Promise((resolve) => setTimeout(resolve, 2));
    const again = await addCollectionProducts(db, collection.id, [BOOTS]);
    if (!again.ok) throw new Error(JSON.stringify(again.errors));
    expect(again.collection.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(await linkedProducts()).toEqual([BOOTS, SHOES].sort());
  });

  it("removes products idempotently and bumps updatedAt", async () => {
    const collection = await mustCreate({ name: "Featured", products: [BOOTS, SHOES] });
    await new Promise((resolve) => setTimeout(resolve, 2));

    const first = await removeCollectionProducts(db, collection.id, [BOOTS, HATS]);
    if (!first.ok) throw new Error(JSON.stringify(first.errors));
    expect(first.collection.updatedAt.getTime()).toBeGreaterThan(collection.updatedAt.getTime());
    expect(await linkedProducts()).toEqual([SHOES]);

    const again = await removeCollectionProducts(db, collection.id, [BOOTS]);
    expect(again.ok).toBe(true);
    expect(await linkedProducts()).toEqual([SHOES]);
  });

  it("reports an unknown collection without changing anything", async () => {
    await mustCreate({ name: "Featured", products: [BOOTS] });
    const id = crypto.randomUUID();

    const result = await addCollectionProducts(db, id, [SHOES]);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "collectionId",
          code: "NOT_FOUND",
          message: `Couldn't resolve to a node: ${toGlobalId("Collection", id)}`,
        },
      ],
    });
    expect(await linkedProducts()).toEqual([BOOTS]);

    const removed = await removeCollectionProducts(db, id, [BOOTS]);
    expect(removed.ok).toBe(false);
    expect(await linkedProducts()).toEqual([BOOTS]);
  });

  it("reports unknown products without changing anything", async () => {
    const collection = await mustCreate({ name: "Featured", products: [BOOTS] });
    const missing = crypto.randomUUID();
    const expected = {
      ok: false,
      errors: [
        {
          field: "products",
          code: "NOT_FOUND",
          message: `Couldn't resolve to a node: ${toGlobalId("Product", missing)}.`,
        },
      ],
    };

    await expect(addCollectionProducts(db, collection.id, [SHOES, missing])).resolves.toEqual(
      expected,
    );
    await expect(removeCollectionProducts(db, collection.id, [BOOTS, missing])).resolves.toEqual(
      expected,
    );
    expect(await linkedProducts()).toEqual([BOOTS]);
  });
});

describe("listCollections", () => {
  it("shows the public only published, non-future collections", async () => {
    await mustCreate({ name: "Visible", isPublished: true });
    await mustCreate({ name: "Hidden" });
    const scheduled = await mustCreate({ name: "Scheduled", isPublished: true });
    await schedule(scheduled.id, new Date(Date.now() + 24 * 60 * 60 * 1000));

    const public_ = await listCollections(db, { first: 10 });
    expect(collectionNames(public_)).toEqual(["Visible"]);
    expect(public_.totalCount).toBe(1);

    const staff = await listCollections(db, { first: 10, includeUnpublished: true });
    expect(collectionNames(staff)).toEqual(["Hidden", "Scheduled", "Visible"]);
    expect(staff.totalCount).toBe(3);
  });

  it("narrows staff results by published, and ignores it for the public", async () => {
    await mustCreate({ name: "Live", isPublished: true });
    await mustCreate({ name: "Draft" });

    const published = await listCollections(db, {
      first: 10,
      includeUnpublished: true,
      published: "PUBLISHED",
    });
    expect(collectionNames(published)).toEqual(["Live"]);

    const hidden = await listCollections(db, {
      first: 10,
      includeUnpublished: true,
      published: "HIDDEN",
    });
    expect(collectionNames(hidden)).toEqual(["Draft"]);

    // The public only ever sees the visible ones, whatever `published` says.
    const anonymous = await listCollections(db, { first: 10, published: "HIDDEN" });
    expect(collectionNames(anonymous)).toEqual(["Live"]);
  });

  it("searches name and slug case-insensitively and escapes LIKE wildcards", async () => {
    await mustCreate({ name: "Summer Sale", isPublished: true });
    await mustCreate({ name: "Winter", slug: "sale-2026", isPublished: true });
    await mustCreate({ name: "Plain", isPublished: true });

    expect(collectionNames(await listCollections(db, { first: 10, search: "SALE" }))).toEqual([
      "Summer Sale",
      "Winter",
    ]);

    await mustCreate({ name: "A_B", isPublished: true });
    await mustCreate({ name: "AB", isPublished: true });
    expect(collectionNames(await listCollections(db, { first: 10, search: "A_B" }))).toEqual([
      "A_B",
    ]);
    expect(collectionNames(await listCollections(db, { first: 10, search: "100%" }))).toEqual([]);
  });

  it("filters by id, and an explicit empty list matches nothing", async () => {
    const first = await mustCreate({ name: "First", isPublished: true });
    await mustCreate({ name: "Second", isPublished: true });

    const page = await listCollections(db, { first: 10, ids: [first.id] });
    expect(collectionNames(page)).toEqual(["First"]);
    expect(page.totalCount).toBe(1);

    const empty = await listCollections(db, { first: 10, ids: [] });
    expect(empty.rows).toEqual([]);
    expect(empty.totalCount).toBe(0);
  });

  it("sorts by name, availability and product count with pages that join up", async () => {
    await mustCreate({ name: "Alpha", isPublished: true, products: [BOOTS] });
    await mustCreate({ name: "Beta", products: [BOOTS, SHOES, HATS] });
    await mustCreate({ name: "Gamma", products: [SHOES] });
    await mustCreate({ name: "Delta", isPublished: true });

    const byName = await listCollections(db, {
      first: 2,
      includeUnpublished: true,
      sort: { field: "NAME", direction: "ASC" },
    });
    expect(collectionNames(byName)).toEqual(["Alpha", "Beta"]);
    expect(byName.totalCount).toBe(4);
    expect(byName.hasNextPage).toBe(true);

    const next = await listCollections(db, {
      first: 2,
      after: byName.rows[1]?.cursor,
      includeUnpublished: true,
      sort: { field: "NAME", direction: "ASC" },
    });
    expect(collectionNames(next)).toEqual(["Delta", "Gamma"]);

    const backwards = await listCollections(db, {
      last: 3,
      includeUnpublished: true,
      sort: { field: "NAME", direction: "ASC" },
    });
    expect(collectionNames(backwards)).toEqual(["Beta", "Delta", "Gamma"]);
    expect(backwards.hasPreviousPage).toBe(true);

    const byAvailability = await listCollections(db, {
      first: 10,
      includeUnpublished: true,
      sort: { field: "AVAILABILITY", direction: "DESC" },
    });
    expect(collectionNames(byAvailability).slice(0, 2).sort()).toEqual(["Alpha", "Delta"]);

    const byProductCount = await listCollections(db, {
      first: 10,
      includeUnpublished: true,
      sort: { field: "PRODUCT_COUNT", direction: "DESC" },
    });
    expect(collectionNames(byProductCount)[0]).toBe("Beta");
    expect(byProductCount.rows.map((row) => row.node.productCount)).toEqual([3, 1, 1, 0]);
  });

  it("rejects a malformed cursor", async () => {
    await mustCreate({ name: "Alpha" });

    await expect(listCollections(db, { first: 5, after: "garbage" })).rejects.toBeInstanceOf(
      InvalidCursorError,
    );

    const tampered = Buffer.from(JSON.stringify(["Alpha", "not-a-uuid"])).toString("base64");
    await expect(listCollections(db, { first: 5, after: tampered })).rejects.toBeInstanceOf(
      InvalidCursorError,
    );

    const badValue = Buffer.from(
      JSON.stringify(["x", "00000000-0000-4000-8000-000000000001"]),
    ).toString("base64");
    await expect(
      listCollections(db, {
        first: 5,
        after: badValue,
        sort: { field: "PRODUCT_COUNT", direction: "ASC" },
      }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it("counts the linked products on each row", async () => {
    const collection = await mustCreate({
      name: "Featured",
      isPublished: true,
      products: [BOOTS, SHOES],
    });

    const page = await listCollections(db, { first: 1 });
    expect(page.rows[0]?.node).toMatchObject({ id: collection.id, productCount: 2 });
  });
});

// ---------------------------------------------------------------------------------------------
// GraphQL

const COLLECTION_FIELDS = "id name slug description isPublished publishedAt";
const ERRORS = "errors { field code message }";

const CREATE = `mutation ($input: CollectionCreateInput!) {
  collectionCreate(input: $input) { collection { ${COLLECTION_FIELDS} } ${ERRORS} }
}`;
const UPDATE = `mutation ($id: ID!, $input: CollectionInput!) {
  collectionUpdate(id: $id, input: $input) { collection { ${COLLECTION_FIELDS} } ${ERRORS} }
}`;
const DELETE = `mutation ($id: ID!) {
  collectionDelete(id: $id) { collection { ${COLLECTION_FIELDS} } ${ERRORS} }
}`;
const BULK_DELETE = `mutation ($ids: [ID!]!) {
  collectionBulkDelete(ids: $ids) { count ${ERRORS} }
}`;
const ADD_PRODUCTS = `mutation ($collectionId: ID!, $products: [ID!]!) {
  collectionAddProducts(collectionId: $collectionId, products: $products) {
    collection { ${COLLECTION_FIELDS} } ${ERRORS}
  }
}`;
const REMOVE_PRODUCTS = `mutation ($collectionId: ID!, $products: [ID!]!) {
  collectionRemoveProducts(collectionId: $collectionId, products: $products) {
    collection { ${COLLECTION_FIELDS} } ${ERRORS}
  }
}`;
const QUERY = `query ($id: ID, $slug: String) {
  collection(id: $id, slug: $slug) { ${COLLECTION_FIELDS} }
}`;
const COLLECTIONS = `query ($first: Int, $last: Int, $after: String, $before: String, $filter: CollectionFilterInput, $sortBy: CollectionSortingInput) {
  collections(first: $first, last: $last, after: $after, before: $before, filter: $filter, sortBy: $sortBy) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges { cursor node { id name isPublished } }
  }
}`;

const collectionId = (id: string) => toGlobalId("Collection", id);
const productId = (id: string) => toGlobalId("Product", id);

type ErrorData = { field: string | null; code: string; message: string };
type CollectionData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  publishedAt: string | null;
};
type PayloadData = { collection: CollectionData | null; errors: ErrorData[] };
type PageData = {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: { cursor: string; node: { id: string; name: string; isPublished: boolean } }[];
};

function mutationData(result: GqlResult, field: string): PayloadData {
  const root = result.body.data as Record<string, PayloadData> | null | undefined;
  const value = root?.[field];
  if (!value) throw new Error(`Missing ${field} payload: ${JSON.stringify(result.body)}`);
  return value;
}

function collectionOf(payload: PayloadData): CollectionData {
  if (!payload.collection) throw new Error("Expected a collection in the payload");
  return payload.collection;
}

const errorOf = (result: GqlResult) => result.body.errors?.[0]?.message;

async function collections(variables: object, token?: string): Promise<PageData> {
  const result = await client.gql(COLLECTIONS, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { collections: PageData }).collections;
}

const pageNames = (page: PageData) => page.edges.map((edge) => edge.node.name);

describe.each([
  { name: "collectionCreate", doc: CREATE, vars: () => ({ input: { name: "Guarded" } }) },
  {
    name: "collectionUpdate",
    doc: UPDATE,
    vars: async () => ({
      id: collectionId((await mustCreate({ name: "Guarded" })).id),
      input: { name: "Changed" },
    }),
  },
  {
    name: "collectionDelete",
    doc: DELETE,
    vars: async () => ({ id: collectionId((await mustCreate({ name: "Guarded" })).id) }),
  },
  {
    name: "collectionBulkDelete",
    doc: BULK_DELETE,
    vars: async () => ({ ids: [collectionId((await mustCreate({ name: "Guarded" })).id)] }),
  },
  {
    name: "collectionAddProducts",
    doc: ADD_PRODUCTS,
    vars: async () => ({
      collectionId: collectionId((await mustCreate({ name: "Guarded" })).id),
      products: [productId(BOOTS)],
    }),
  },
  {
    name: "collectionRemoveProducts",
    doc: REMOVE_PRODUCTS,
    vars: async () => ({
      collectionId: collectionId((await mustCreate({ name: "Guarded", products: [BOOTS] })).id),
      products: [productId(BOOTS)],
    }),
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
    if (name === "collectionBulkDelete") {
      expect((result.body.data as Record<string, { count: number }>)[name]?.count).toBe(1);
    } else {
      expect(mutationData(result, name).errors).toEqual([]);
    }
  });
});

describe("collectionCreate", () => {
  it("creates a published collection with a generated slug, JSON description and products", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const description = { time: 1, blocks: [{ data: { text: "Featured products" } }] };

    const result = await client.gql(
      CREATE,
      {
        input: {
          name: "Featured",
          description: JSON.stringify(description),
          isPublished: true,
          products: [productId(BOOTS), productId(SHOES)],
        },
      },
      admin.token,
    );

    expect(result.body.errors).toBeUndefined();
    const created = collectionOf(mutationData(result, "collectionCreate"));
    expect(created).toMatchObject({
      name: "Featured",
      slug: "featured",
      isPublished: true,
    });
    expect(JSON.parse(created.description ?? "")).toEqual(description);
    expect(new Date(created.publishedAt ?? "").toISOString()).toBe(created.publishedAt);
    expect(await linkedProducts()).toEqual([BOOTS, SHOES].sort());
  });

  it("returns REQUIRED, UNIQUE, INVALID and NOT_FOUND values", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const create = async (input: object) =>
      mutationData(await client.gql(CREATE, { input }, admin.token), "collectionCreate");

    expect(await create({})).toEqual({
      collection: null,
      errors: [{ field: "name", code: "REQUIRED", message: "This field cannot be blank." }],
    });

    await mustCreate({ name: "Existing", slug: "taken" });
    expect(await create({ name: "Other", slug: "taken" })).toMatchObject({
      collection: null,
      errors: [{ field: "slug", code: "UNIQUE" }],
    });

    expect(
      await create({
        name: "Invalid",
        slug: "not valid!",
        description: JSON.stringify({ blocks: "not-an-array" }),
      }),
    ).toMatchObject({
      collection: null,
      errors: [
        { field: "slug", code: "INVALID" },
        { field: "description", code: "INVALID" },
      ],
    });

    const missing = crypto.randomUUID();
    expect(await create({ name: "Products", products: [productId(missing)] })).toMatchObject({
      collection: null,
      errors: [
        {
          field: "products",
          code: "NOT_FOUND",
          message: `Couldn't resolve to a node: ${productId(missing)}.`,
        },
      ],
    });
    expect(await db.select().from(schema.collection)).toHaveLength(1);
  });

  it("returns top-level errors for a malformed product id and invalid JSONString input", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const malformed = await client.gql(
      CREATE,
      { input: { name: "Broken", products: ["nope"] } },
      admin.token,
    );
    expect(errorOf(malformed)).toBe("Couldn't resolve id: nope.");

    const invalidJson = await client.gql(
      CREATE,
      { input: { name: "Broken", description: "{not-json" } },
      admin.token,
    );
    expect(errorOf(invalidJson)).toContain("Unable to parse JSON string.");
  });
});

describe("collectionUpdate", () => {
  it("updates fields, publishes once and returns a top-level error for an unknown id", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const before = await mustCreate({ name: "Draft" });
    const description = { blocks: [{ data: { text: "New text" } }] };

    const result = await client.gql(
      UPDATE,
      {
        id: collectionId(before.id),
        input: { name: "Live", isPublished: true, description: JSON.stringify(description) },
      },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    const updated = collectionOf(mutationData(result, "collectionUpdate"));
    expect(updated).toMatchObject({ id: collectionId(before.id), name: "Live", isPublished: true });
    expect(JSON.parse(updated.description ?? "")).toEqual(description);
    expect(updated.publishedAt).not.toBeNull();

    const again = collectionOf(
      mutationData(
        await client.gql(
          UPDATE,
          { id: collectionId(before.id), input: { isPublished: true } },
          admin.token,
        ),
        "collectionUpdate",
      ),
    );
    expect(again.publishedAt).toBe(updated.publishedAt);

    const unknown = collectionId(crypto.randomUUID());
    const notFound = await client.gql(
      UPDATE,
      { id: unknown, input: { name: "Missing" } },
      admin.token,
    );
    expect(errorOf(notFound)).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
  });
});

describe("collectionDelete and collectionBulkDelete", () => {
  it("returns the pre-delete collection, keeping its products", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const collection = await mustCreate({ name: "Featured", products: [BOOTS] });

    const result = await client.gql(DELETE, { id: collectionId(collection.id) }, admin.token);
    expect(result.body.errors).toBeUndefined();
    expect(mutationData(result, "collectionDelete")).toMatchObject({
      collection: { id: collectionId(collection.id), name: "Featured" },
      errors: [],
    });
    expect(await db.select().from(schema.collection)).toEqual([]);
    expect(await linkedProducts()).toEqual([]);
    expect(await db.select().from(schema.product)).toHaveLength(3);
  });

  it("bulk deletes with a count and refuses unknown ids", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const first = await mustCreate({ name: "First", products: [BOOTS] });
    const second = await mustCreate({ name: "Second" });

    const result = await client.gql(
      BULK_DELETE,
      { ids: [collectionId(first.id), collectionId(first.id)] },
      admin.token,
    );
    expect(result.body.data).toEqual({ collectionBulkDelete: { count: 1, errors: [] } });

    const unknown = collectionId(crypto.randomUUID());
    const notFound = await client.gql(
      BULK_DELETE,
      { ids: [collectionId(second.id), unknown] },
      admin.token,
    );
    expect(errorOf(notFound)).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
    expect((await db.select().from(schema.collection)).map((row) => row.name)).toEqual(["Second"]);
  });
});

describe("collectionAddProducts and collectionRemoveProducts", () => {
  it("adds and removes idempotently, and reports unknown nodes as payload errors", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const collection = await mustCreate({ name: "Featured" });

    const added = await client.gql(
      ADD_PRODUCTS,
      { collectionId: collectionId(collection.id), products: [productId(BOOTS), productId(BOOTS)] },
      admin.token,
    );
    expect(added.body.errors).toBeUndefined();
    expect(mutationData(added, "collectionAddProducts").errors).toEqual([]);
    expect(await linkedProducts()).toEqual([BOOTS]);

    const unknownProduct = crypto.randomUUID();
    const missingProduct = await client.gql(
      ADD_PRODUCTS,
      { collectionId: collectionId(collection.id), products: [productId(unknownProduct)] },
      admin.token,
    );
    expect(mutationData(missingProduct, "collectionAddProducts")).toMatchObject({
      collection: null,
      errors: [
        {
          field: "products",
          code: "NOT_FOUND",
          message: `Couldn't resolve to a node: ${productId(unknownProduct)}.`,
        },
      ],
    });
    expect(await linkedProducts()).toEqual([BOOTS]);

    const unknownCollection = crypto.randomUUID();
    const missingCollection = await client.gql(
      REMOVE_PRODUCTS,
      { collectionId: collectionId(unknownCollection), products: [productId(BOOTS)] },
      admin.token,
    );
    expect(mutationData(missingCollection, "collectionRemoveProducts")).toMatchObject({
      collection: null,
      errors: [
        {
          field: "collectionId",
          code: "NOT_FOUND",
          message: `Couldn't resolve to a node: ${collectionId(unknownCollection)}`,
        },
      ],
    });
    expect(await linkedProducts()).toEqual([BOOTS]);

    const removed = await client.gql(
      REMOVE_PRODUCTS,
      { collectionId: collectionId(collection.id), products: [productId(BOOTS)] },
      admin.token,
    );
    expect(mutationData(removed, "collectionRemoveProducts")).toMatchObject({ errors: [] });
    expect(await linkedProducts()).toEqual([]);
  });
});

describe("collection and collections queries", () => {
  it("shows the public only visible collections, and staff everything", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    await mustCreate({ name: "Visible", isPublished: true });
    await mustCreate({ name: "Draft" });
    const scheduled = await mustCreate({ name: "Scheduled", isPublished: true });
    await schedule(scheduled.id, new Date(Date.now() + 24 * 60 * 60 * 1000));

    expect(pageNames(await collections({ first: 10 }))).toEqual(["Visible"]);

    const staff = await collections({ first: 10 }, admin.token);
    expect(pageNames(staff)).toEqual(["Draft", "Scheduled", "Visible"]);
    expect(staff.totalCount).toBe(3);

    const filtered = await collections(
      { first: 10, filter: { published: "PUBLISHED" } },
      admin.token,
    );
    expect(pageNames(filtered)).toEqual(["Scheduled", "Visible"]);

    const hidden = await collections({ first: 10, filter: { published: "HIDDEN" } });
    expect(pageNames(hidden)).toEqual(["Visible"]);
  });

  it("looks a collection up by id or slug and hides invisible ones", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const visible = await mustCreate({ name: "Visible", isPublished: true });
    const draft = await mustCreate({ name: "Draft" });

    const byId = await client.gql(QUERY, { id: collectionId(visible.id) });
    expect(byId.body.errors).toBeUndefined();
    expect(byId.body.data).toMatchObject({
      collection: { id: collectionId(visible.id), slug: visible.slug, isPublished: true },
    });

    const bySlug = await client.gql(QUERY, { slug: visible.slug });
    expect(bySlug.body.data).toMatchObject({ collection: { id: collectionId(visible.id) } });

    const hidden = await client.gql(QUERY, { id: collectionId(draft.id) });
    expect(hidden.body.data).toEqual({ collection: null });
    const hiddenSlug = await client.gql(QUERY, { slug: draft.slug });
    expect(hiddenSlug.body.data).toEqual({ collection: null });

    const asStaff = await client.gql(QUERY, { slug: draft.slug }, admin.token);
    expect(asStaff.body.data).toMatchObject({ collection: { id: collectionId(draft.id) } });

    const unknownId = await client.gql(QUERY, { id: collectionId(crypto.randomUUID()) });
    expect(unknownId.body.data).toEqual({ collection: null });
    const unknownSlug = await client.gql(QUERY, { slug: "unknown" });
    expect(unknownSlug.body.data).toEqual({ collection: null });
  });

  it("requires exactly one of id and slug and uses Saleor's errors", async () => {
    const neither = await client.gql(QUERY);
    expect(errorOf(neither)).toBe("At least one of arguments is required: 'id', 'slug'.");

    const both = await client.gql(QUERY, {
      id: collectionId(crypto.randomUUID()),
      slug: "featured",
    });
    expect(errorOf(both)).toBe("Argument 'id' cannot be combined with 'slug'");

    const malformed = await client.gql(QUERY, { id: "nope" });
    expect(errorOf(malformed)).toBe("Couldn't resolve id: nope.");

    const wrongType = toGlobalId("Product", crypto.randomUUID());
    const result = await client.gql(QUERY, { id: wrongType });
    expect(errorOf(result)).toBe(
      `Invalid ID: ${wrongType}. Expected: Collection, received: Product.`,
    );
  });

  it("searches, sorts and paginates with totalCount", async () => {
    const alpha = await mustCreate({ name: "Alpha", isPublished: true, products: [BOOTS] });
    await mustCreate({ name: "Beta", isPublished: true, products: [BOOTS, SHOES] });
    await mustCreate({ name: "Gamma", isPublished: true });

    const first = await collections({ first: 2, sortBy: { field: "NAME", direction: "ASC" } });
    expect(pageNames(first)).toEqual(["Alpha", "Beta"]);
    expect(first.totalCount).toBe(3);
    expect(first.pageInfo.hasNextPage).toBe(true);

    const second = await collections({
      first: 2,
      after: first.pageInfo.endCursor,
      sortBy: { field: "NAME", direction: "ASC" },
    });
    expect(pageNames(second)).toEqual(["Gamma"]);
    expect(second.pageInfo.hasPreviousPage).toBe(true);

    const lastPage = await collections({ last: 1, sortBy: { field: "NAME", direction: "ASC" } });
    expect(pageNames(lastPage)).toEqual(["Gamma"]);

    const byCount = await collections({
      first: 10,
      sortBy: { field: "PRODUCT_COUNT", direction: "DESC" },
    });
    expect(pageNames(byCount)[0]).toBe("Beta");

    expect(pageNames(await collections({ first: 10, filter: { search: "a" } }))).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);

    expect(
      pageNames(await collections({ first: 10, filter: { ids: [collectionId(alpha.id)] } })),
    ).toEqual(["Alpha"]);
  });

  it("refuses Saleor's invalid arguments and cursors", async () => {
    await mustCreate({ name: "Alpha", isPublished: true });

    expect(errorOf(await client.gql(COLLECTIONS, {}))).toBe(
      "You must provide a `first` or `last` value to properly paginate the `collections` connection.",
    );
    expect(errorOf(await client.gql(COLLECTIONS, { first: 101 }))).toBe(
      "Requesting 101 records on the `collections` connection exceeds the `first` limit of 100 records.",
    );
    expect(errorOf(await client.gql(COLLECTIONS, { first: 5, after: "garbage" }))).toBe(
      "Received cursor is invalid.",
    );

    const malformedId = await client.gql(COLLECTIONS, { first: 5, filter: { ids: ["garbage"] } });
    expect(errorOf(malformedId)).toBe("Couldn't resolve id: garbage.");
  });

  it("supports asking for totalCount alone", async () => {
    await mustCreate({ name: "Alpha", isPublished: true });

    const result = await client.gql(`query { collections { totalCount } }`);
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({ collections: { totalCount: 1 } });
  });
});
