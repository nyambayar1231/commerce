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
import { InvalidCursorError } from "../catalog/index.ts";
import { createSession } from "../identity/index.ts";
import {
  createPage,
  deletePage,
  deletePages,
  getPage,
  listPages,
  type PageCreateInput,
  PageNotFoundError,
  type PageResult,
  type PageRow,
  updatePage,
} from "./index.ts";

// Domain and GraphQL contract tests for Saleor's pages (M15.6a), against the real (test)
// database and the real Yoga app.
const db = getDb();
const client = createTestClient(db);

const ABOUT = {
  time: 1,
  blocks: [
    { data: { text: "<p>We <strong>sell</strong> things</p>" } },
    { data: { text: "Second block" } },
  ],
  version: "2.30.0",
};

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, page CASCADE');
});

afterAll(async () => {
  await closeDb();
});

async function mustCreate(input: PageCreateInput): Promise<PageRow> {
  const result = await createPage(db, input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
}

function expectFailure(result: PageResult) {
  if (result.ok) throw new Error("expected page validation to fail");
  return result.errors;
}

const pageTitles = (page: { rows: { node: PageRow }[] }) => page.rows.map((row) => row.node.title);

const schedule = (id: string, publishedAt: Date) =>
  db.update(schema.page).set({ publishedAt }).where(eq(schema.page.id, id));

describe("createPage", () => {
  it("creates an unpublished page with a generated slug and EditorJS plaintext", async () => {
    const page = await mustCreate({ title: "  About us  ", content: ABOUT });

    expect(page).toMatchObject({
      title: "About us",
      slug: "about-us",
      content: ABOUT,
      contentPlaintext: "We sell things Second block",
      isPublished: false,
      publishedAt: null,
    });
  });

  it("stamps publishedAt when created published", async () => {
    const page = await mustCreate({ title: "Shipping", isPublished: true });

    expect(page.isPublished).toBe(true);
    expect(page.publishedAt).toBeInstanceOf(Date);
  });

  it("generates the first free suffix and matches existing slugs case-insensitively", async () => {
    await mustCreate({ title: "Gift Cards", slug: "GIFT-CARDS" });
    const second = await mustCreate({ title: "Gift Cards" });
    const third = await mustCreate({ title: "Gift Cards" });

    expect([second.slug, third.slug]).toEqual(["gift-cards-2", "gift-cards-3"]);
  });

  it("slugifies a Mongolian title", async () => {
    const page = await mustCreate({ title: "Бидний тухай" });
    expect(page.slug).toBe("bidnii-tukhai");
  });

  it("reports a taken or invalid slug and a blank title without writing", async () => {
    await mustCreate({ title: "Existing", slug: "taken" });

    const taken = await createPage(db, { title: "Other", slug: "taken" });
    expect(expectFailure(taken)).toEqual([
      { field: "slug", code: "UNIQUE", message: "Page with this Slug already exists." },
    ]);

    const blank = await createPage(db, {
      title: "  ",
      slug: "not valid!",
      content: { blocks: "not-an-array" },
    });
    expect(expectFailure(blank)).toEqual([
      { field: "title", code: "REQUIRED", message: "This field cannot be blank." },
      {
        field: "slug",
        code: "INVALID",
        message: "Enter a valid “slug” consisting of letters, numbers, underscores or hyphens.",
      },
      { field: "content", code: "INVALID", message: "Invalid EditorJS data." },
    ]);

    expect(await db.select().from(schema.page)).toHaveLength(1);
  });

  it("reports a title longer than Saleor's 250 characters", async () => {
    const result = await createPage(db, { title: "a".repeat(251) });
    expect(expectFailure(result)).toEqual([
      {
        field: "title",
        code: "INVALID",
        message: "Ensure this value has at most 250 characters (it has 251).",
      },
    ]);
  });
});

describe("getPage and updatePage", () => {
  it("finds a page by id or slug and returns null for an unknown one", async () => {
    const page = await mustCreate({ title: "About" });

    await expect(getPage(db, { id: page.id })).resolves.toEqual(page);
    await expect(getPage(db, { slug: page.slug })).resolves.toEqual(page);
    await expect(getPage(db, { id: crypto.randomUUID() })).resolves.toBeNull();
    await expect(getPage(db, { slug: "unknown" })).resolves.toBeNull();
  });

  it("updates only the given fields and advances updatedAt", async () => {
    const before = await mustCreate({ title: "Old", content: { blocks: [] } });
    await new Promise((resolve) => setTimeout(resolve, 2));

    const result = await updatePage(db, before.id, { title: "  New  " });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    expect(result.page).toMatchObject({
      id: before.id,
      title: "New",
      slug: before.slug,
      content: { blocks: [] },
    });
    expect(result.page.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("stamps publishedAt on the first publication only and clears it when unpublished", async () => {
    const page = await mustCreate({ title: "Draft" });

    const published = await updatePage(db, page.id, { isPublished: true });
    if (!published.ok) throw new Error(JSON.stringify(published.errors));
    const firstPublishedAt = published.page.publishedAt;
    expect(firstPublishedAt).toBeInstanceOf(Date);

    await new Promise((resolve) => setTimeout(resolve, 2));
    const again = await updatePage(db, page.id, { isPublished: true, title: "Live" });
    if (!again.ok) throw new Error(JSON.stringify(again.errors));
    expect(again.page.publishedAt).toEqual(firstPublishedAt);

    const unpublished = await updatePage(db, page.id, { isPublished: false });
    if (!unpublished.ok) throw new Error(JSON.stringify(unpublished.errors));
    expect(unpublished.page.publishedAt).toBeNull();
  });

  it("rejects a blank slug, a taken slug and invalid content without writing", async () => {
    const page = await mustCreate({ title: "Guarded" });
    await mustCreate({ title: "Other", slug: "taken" });

    const blank = await updatePage(db, page.id, { slug: "" });
    expect(expectFailure(blank)).toEqual([
      { field: "slug", code: "INVALID", message: "Slug value cannot be blank." },
    ]);

    const taken = await updatePage(db, page.id, { slug: "taken" });
    expect(expectFailure(taken)).toEqual([
      { field: "slug", code: "UNIQUE", message: "Page with this Slug already exists." },
    ]);

    const invalid = await updatePage(db, page.id, { content: "not-an-object" });
    expect(expectFailure(invalid)).toEqual([
      { field: "content", code: "INVALID", message: "Invalid EditorJS data." },
    ]);

    await expect(getPage(db, { id: page.id })).resolves.toMatchObject({
      title: "Guarded",
      slug: "guarded",
    });
  });

  it("replaces the content and its plaintext", async () => {
    const page = await mustCreate({ title: "About", content: ABOUT });
    const content = { blocks: [{ data: { text: "New text" } }] };

    const result = await updatePage(db, page.id, { content });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.page).toMatchObject({ content, contentPlaintext: "New text" });
  });

  it("reports an unknown id", async () => {
    const missing = crypto.randomUUID();
    await expect(updatePage(db, missing, { title: "Missing" })).rejects.toEqual(
      expect.objectContaining({ kind: "Page", ids: [missing] }),
    );
  });
});

describe("deletePage and deletePages", () => {
  it("deletes one page and returns the deleted row", async () => {
    const page = await mustCreate({ title: "About" });

    await expect(deletePage(db, page.id)).resolves.toEqual(page);
    expect(await db.select().from(schema.page)).toEqual([]);
    await expect(deletePage(db, page.id)).rejects.toBeInstanceOf(PageNotFoundError);
  });

  it("bulk deletes with a count, counting a duplicate id once", async () => {
    const first = await mustCreate({ title: "First" });
    const second = await mustCreate({ title: "Second" });

    await expect(deletePages(db, [first.id, first.id])).resolves.toEqual({ count: 1 });
    expect(await db.select().from(schema.page)).toEqual([second]);
  });

  it("bulk deletes nothing when an id is unknown", async () => {
    const page = await mustCreate({ title: "Kept" });
    const missing = crypto.randomUUID();

    await expect(deletePages(db, [page.id, missing])).rejects.toEqual(
      expect.objectContaining({ kind: "Page", ids: [missing] }),
    );
    expect(await db.select().from(schema.page)).toHaveLength(1);
  });
});

describe("listPages", () => {
  it("shows the public only visible pages, and staff everything", async () => {
    await mustCreate({ title: "Hidden" });
    await mustCreate({ title: "Visible", isPublished: true });
    const scheduled = await mustCreate({ title: "Scheduled", isPublished: true });
    await schedule(scheduled.id, new Date(Date.now() + 24 * 60 * 60 * 1000));

    const anonymous = await listPages(db, { first: 10 });
    expect(pageTitles(anonymous)).toEqual(["Visible"]);
    expect(anonymous.totalCount).toBe(1);

    const staff = await listPages(db, { first: 10, includeUnpublished: true });
    expect(pageTitles(staff)).toEqual(["Hidden", "Scheduled", "Visible"]);
    expect(staff.totalCount).toBe(3);
  });

  it("searches title and slug case-insensitively and escapes LIKE wildcards", async () => {
    await mustCreate({ title: "About us", isPublished: true });
    await mustCreate({ title: "Returns", slug: "about-shipping", isPublished: true });
    await mustCreate({ title: "Plain", isPublished: true });

    expect(pageTitles(await listPages(db, { first: 10, search: "ABOUT" }))).toEqual([
      "About us",
      "Returns",
    ]);

    await mustCreate({ title: "A_B", isPublished: true });
    await mustCreate({ title: "AB", isPublished: true });
    expect(pageTitles(await listPages(db, { first: 10, search: "A_B" }))).toEqual(["A_B"]);
    expect(pageTitles(await listPages(db, { first: 10, search: "100%" }))).toEqual([]);
  });

  it("filters by id, and an explicit empty list matches nothing", async () => {
    const first = await mustCreate({ title: "First", isPublished: true });
    await mustCreate({ title: "Second", isPublished: true });

    const page = await listPages(db, { first: 10, ids: [first.id] });
    expect(pageTitles(page)).toEqual(["First"]);
    expect(page.totalCount).toBe(1);

    const empty = await listPages(db, { first: 10, ids: [] });
    expect(empty.rows).toEqual([]);
    expect(empty.totalCount).toBe(0);
  });

  it("sorts by title by default, and by slug and visibility", async () => {
    await mustCreate({ title: "Beta", slug: "zeta", isPublished: true });
    await mustCreate({ title: "Alpha", slug: "alpha" });
    await mustCreate({ title: "Gamma", slug: "beta", isPublished: true });

    expect(pageTitles(await listPages(db, { first: 10, includeUnpublished: true }))).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);

    expect(
      pageTitles(
        await listPages(db, {
          first: 10,
          sort: { field: "SLUG", direction: "DESC" },
        }),
      ),
    ).toEqual(["Beta", "Gamma"]);

    const byVisibility = await listPages(db, {
      first: 10,
      includeUnpublished: true,
      sort: { field: "VISIBILITY", direction: "DESC" },
    });
    expect(pageTitles(byVisibility).slice(0, 2).sort()).toEqual(["Beta", "Gamma"]);
    expect(byVisibility.rows.map((row) => row.node.isPublished)).toEqual([true, true, false]);
  });

  it("sorts by creation and publication date, with never-published pages last ascending", async () => {
    const first = await mustCreate({ title: "First" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await mustCreate({ title: "Second" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const third = await mustCreate({ title: "Third" });

    const byCreation = await listPages(db, {
      first: 10,
      includeUnpublished: true,
      sort: { field: "CREATION_DATE", direction: "ASC" },
    });
    expect(byCreation.rows.map((row) => row.node.id)).toEqual([first.id, second.id, third.id]);

    await db
      .update(schema.page)
      .set({ isPublished: true, publishedAt: new Date("2026-01-02T00:00:00Z") })
      .where(eq(schema.page.id, second.id));
    await db
      .update(schema.page)
      .set({ isPublished: true, publishedAt: new Date("2026-01-01T00:00:00Z") })
      .where(eq(schema.page.id, third.id));

    const byPublication = await listPages(db, {
      first: 10,
      includeUnpublished: true,
      sort: { field: "PUBLICATION_DATE", direction: "ASC" },
    });
    expect(byPublication.rows.map((row) => row.node.title)).toEqual(["Third", "Second", "First"]);

    const descending = await listPages(db, {
      first: 10,
      includeUnpublished: true,
      sort: { field: "PUBLICATION_DATE", direction: "DESC" },
    });
    expect(descending.rows.map((row) => row.node.title)).toEqual(["First", "Second", "Third"]);
  });

  it("paginates forwards and backwards without gaps or overlaps", async () => {
    for (const title of ["Alpha", "Beta", "Delta", "Gamma"]) {
      await mustCreate({ title, isPublished: true });
    }

    const first = await listPages(db, { first: 2, sort: { field: "TITLE", direction: "ASC" } });
    expect(pageTitles(first)).toEqual(["Alpha", "Beta"]);
    expect(first.hasNextPage).toBe(true);
    expect(first.hasPreviousPage).toBe(false);

    const next = await listPages(db, {
      first: 2,
      after: first.rows[1]?.cursor,
      sort: { field: "TITLE", direction: "ASC" },
    });
    expect(pageTitles(next)).toEqual(["Delta", "Gamma"]);
    expect(next.hasNextPage).toBe(false);
    expect(next.hasPreviousPage).toBe(true);

    const backwards = await listPages(db, {
      last: 3,
      before: next.rows[0]?.cursor,
      sort: { field: "TITLE", direction: "ASC" },
    });
    expect(pageTitles(backwards)).toEqual(["Alpha", "Beta"]);
    expect(backwards.hasNextPage).toBe(true);
  });

  it("keeps date cursors pointing at the right row, nulls included", async () => {
    await mustCreate({ title: "Draft" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await mustCreate({ title: "Live", isPublished: true });

    const sort = { field: "PUBLICATION_DATE", direction: "DESC" } as const;
    const first = await listPages(db, { first: 1, includeUnpublished: true, sort });
    expect(pageTitles(first)).toEqual(["Draft"]);

    const rest = await listPages(db, {
      first: 1,
      after: first.rows[0]?.cursor,
      includeUnpublished: true,
      sort,
    });
    expect(pageTitles(rest)).toEqual(["Live"]);
  });

  it("rejects a malformed cursor", async () => {
    await mustCreate({ title: "Alpha" });

    await expect(listPages(db, { first: 5, after: "garbage" })).rejects.toBeInstanceOf(
      InvalidCursorError,
    );

    const tampered = Buffer.from(JSON.stringify(["Alpha", "not-a-uuid"])).toString("base64");
    await expect(listPages(db, { first: 5, after: tampered })).rejects.toBeInstanceOf(
      InvalidCursorError,
    );

    const badValue = Buffer.from(
      JSON.stringify(["x", "00000000-0000-4000-8000-000000000001"]),
    ).toString("base64");
    await expect(
      listPages(db, { first: 5, after: badValue, sort: { field: "VISIBILITY", direction: "ASC" } }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });
});

// ---------------------------------------------------------------------------------------------
// GraphQL

const PAGE_FIELDS = "id title slug content isPublished publishedAt created";
const ERRORS = "errors { field code message }";

const CREATE = `mutation ($input: PageCreateInput!) {
  pageCreate(input: $input) { page { ${PAGE_FIELDS} } ${ERRORS} }
}`;
const UPDATE = `mutation ($id: ID!, $input: PageInput!) {
  pageUpdate(id: $id, input: $input) { page { ${PAGE_FIELDS} } ${ERRORS} }
}`;
const DELETE = `mutation ($id: ID!) {
  pageDelete(id: $id) { page { ${PAGE_FIELDS} } ${ERRORS} }
}`;
const BULK_DELETE = `mutation ($ids: [ID!]!) {
  pageBulkDelete(ids: $ids) { count ${ERRORS} }
}`;
const QUERY = `query ($id: ID, $slug: String) {
  page(id: $id, slug: $slug) { ${PAGE_FIELDS} }
}`;
const PAGES = `query ($first: Int, $last: Int, $after: String, $before: String, $filter: PageFilterInput, $sortBy: PageSortingInput) {
  pages(first: $first, last: $last, after: $after, before: $before, filter: $filter, sortBy: $sortBy) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges { cursor node { id title slug isPublished publishedAt created } }
  }
}`;

const pageId = (id: string) => toGlobalId("Page", id);

type ErrorData = { field: string | null; code: string; message: string };
type PageData = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  created: string;
};
type PayloadData = { page: PageData | null; errors: ErrorData[] };
type PageQueryData = {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: { cursor: string; node: { id: string; title: string; isPublished: boolean } }[];
};

function payloadOf(result: GqlResult, field: string): PayloadData {
  const root = result.body.data as Record<string, PayloadData> | null | undefined;
  const value = root?.[field];
  if (!value) throw new Error(`Missing ${field} payload: ${JSON.stringify(result.body)}`);
  return value;
}

function pageOf(payload: PayloadData): PageData {
  if (!payload.page) throw new Error("Expected a page in the payload");
  return payload.page;
}

const errorOf = (result: GqlResult) => result.body.errors?.[0]?.message;

async function pages(variables: object, token?: string): Promise<PageQueryData> {
  const result = await client.gql(PAGES, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { pages: PageQueryData }).pages;
}

const pageNames = (page: PageQueryData) => page.edges.map((edge) => edge.node.title);

describe.each([
  { name: "pageCreate", doc: CREATE, vars: () => ({ input: { title: "Guarded" } }) },
  {
    name: "pageUpdate",
    doc: UPDATE,
    vars: async () => ({
      id: pageId((await mustCreate({ title: "Guarded" })).id),
      input: { title: "Changed" },
    }),
  },
  {
    name: "pageDelete",
    doc: DELETE,
    vars: async () => ({ id: pageId((await mustCreate({ title: "Guarded" })).id) }),
  },
  {
    name: "pageBulkDelete",
    doc: BULK_DELETE,
    vars: async () => ({ ids: [pageId((await mustCreate({ title: "Guarded" })).id)] }),
  },
])("$name requires MANAGE_PAGES", ({ name, doc, vars }) => {
  it("denies anonymous requests", async () => {
    expectPermissionDenied(await client.gql(doc, await vars()), ["MANAGE_PAGES"]);
  });

  it("denies a customer", async () => {
    const [customer] = await db
      .insert(schema.user)
      .values({ email: `${crypto.randomUUID()}@example.com` })
      .returning({ id: schema.user.id });
    if (!customer) throw new Error("no customer");
    const { token } = await createSession(db, customer.id);
    expectPermissionDenied(await client.gql(doc, await vars(), token), ["MANAGE_PAGES"]);
  });

  it("denies staff without MANAGE_PAGES, including MANAGE_PRODUCTS", async () => {
    const orders = await createStaff(db, ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(doc, await vars(), orders.token), ["MANAGE_PAGES"]);

    const products = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expectPermissionDenied(await client.gql(doc, await vars(), products.token), ["MANAGE_PAGES"]);
  });

  it("allows staff with MANAGE_PAGES", async () => {
    const { token } = await createStaff(db, ["MANAGE_PAGES"]);
    const result = await client.gql(doc, await vars(), token);
    expect(result.body.errors).toBeUndefined();
    if (name === "pageBulkDelete") {
      expect((result.body.data as Record<string, { count: number }>)[name]?.count).toBe(1);
    } else {
      expect(payloadOf(result, name).errors).toEqual([]);
    }
  });
});

describe("pageCreate", () => {
  it("creates a published page with a generated slug and JSON content", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);

    const result = await client.gql(
      CREATE,
      {
        input: {
          title: "About us",
          content: JSON.stringify(ABOUT),
          isPublished: true,
        },
      },
      admin.token,
    );

    expect(result.body.errors).toBeUndefined();
    const created = pageOf(payloadOf(result, "pageCreate"));
    expect(created).toMatchObject({ title: "About us", slug: "about-us", isPublished: true });
    expect(JSON.parse(created.content ?? "")).toEqual(ABOUT);
    expect(new Date(created.publishedAt ?? "").toISOString()).toBe(created.publishedAt);
    expect(new Date(created.created).toISOString()).toBe(created.created);
  });

  it("returns REQUIRED, UNIQUE and INVALID values", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);
    const create = async (input: object) =>
      payloadOf(await client.gql(CREATE, { input }, admin.token), "pageCreate");

    expect(await create({})).toEqual({
      page: null,
      errors: [{ field: "title", code: "REQUIRED", message: "This field cannot be blank." }],
    });

    await mustCreate({ title: "Existing", slug: "taken" });
    expect(await create({ title: "Other", slug: "taken" })).toMatchObject({
      page: null,
      errors: [{ field: "slug", code: "UNIQUE" }],
    });

    expect(
      await create({
        title: "Invalid",
        slug: "not valid!",
        content: JSON.stringify({ blocks: "not-an-array" }),
      }),
    ).toMatchObject({
      page: null,
      errors: [
        { field: "slug", code: "INVALID" },
        { field: "content", code: "INVALID" },
      ],
    });

    expect(await db.select().from(schema.page)).toHaveLength(1);
  });

  it("returns a top-level error for invalid JSONString input", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);

    const invalidJson = await client.gql(
      CREATE,
      { input: { title: "Broken", content: "{not-json" } },
      admin.token,
    );
    expect(errorOf(invalidJson)).toContain("Unable to parse JSON string.");
  });
});

describe("pageUpdate", () => {
  it("updates fields, publishes once and returns a top-level error for an unknown id", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);
    const before = await mustCreate({ title: "Draft" });

    const result = await client.gql(
      UPDATE,
      {
        id: pageId(before.id),
        input: { title: "Live", isPublished: true, content: JSON.stringify(ABOUT) },
      },
      admin.token,
    );
    expect(result.body.errors).toBeUndefined();
    const updated = pageOf(payloadOf(result, "pageUpdate"));
    expect(updated).toMatchObject({ id: pageId(before.id), title: "Live", isPublished: true });
    expect(JSON.parse(updated.content ?? "")).toEqual(ABOUT);
    expect(updated.publishedAt).not.toBeNull();

    const again = pageOf(
      payloadOf(
        await client.gql(
          UPDATE,
          { id: pageId(before.id), input: { isPublished: true } },
          admin.token,
        ),
        "pageUpdate",
      ),
    );
    expect(again.publishedAt).toBe(updated.publishedAt);

    const unknown = pageId(crypto.randomUUID());
    const notFound = await client.gql(
      UPDATE,
      { id: unknown, input: { title: "Missing" } },
      admin.token,
    );
    expect(errorOf(notFound)).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
  });
});

describe("pageDelete and pageBulkDelete", () => {
  it("deletes a page and returns its pre-delete values", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);
    const page = await mustCreate({ title: "About" });

    const result = await client.gql(DELETE, { id: pageId(page.id) }, admin.token);
    expect(result.body.errors).toBeUndefined();
    expect(payloadOf(result, "pageDelete")).toMatchObject({
      page: { id: pageId(page.id), title: "About" },
      errors: [],
    });
    expect(await db.select().from(schema.page)).toEqual([]);
  });

  it("bulk deletes with a count and refuses unknown ids", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);
    const first = await mustCreate({ title: "First" });
    const second = await mustCreate({ title: "Second" });

    const result = await client.gql(
      BULK_DELETE,
      { ids: [pageId(first.id), pageId(first.id)] },
      admin.token,
    );
    expect(result.body.data).toEqual({ pageBulkDelete: { count: 1, errors: [] } });

    const unknown = pageId(crypto.randomUUID());
    const notFound = await client.gql(
      BULK_DELETE,
      { ids: [pageId(second.id), unknown] },
      admin.token,
    );
    expect(errorOf(notFound)).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
    expect((await db.select().from(schema.page)).map((row) => row.title)).toEqual(["Second"]);
  });
});

describe("page and pages queries", () => {
  it("shows the public only visible pages, and staff everything", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);
    await mustCreate({ title: "Visible", isPublished: true });
    await mustCreate({ title: "Draft" });
    const scheduled = await mustCreate({ title: "Scheduled", isPublished: true });
    await schedule(scheduled.id, new Date(Date.now() + 24 * 60 * 60 * 1000));

    expect(pageNames(await pages({ first: 10 }))).toEqual(["Visible"]);

    const staff = await pages({ first: 10 }, admin.token);
    expect(pageNames(staff)).toEqual(["Draft", "Scheduled", "Visible"]);
    expect(staff.totalCount).toBe(3);

    // MANAGE_PRODUCTS is not enough: the page stays hidden.
    const products = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(pageNames(await pages({ first: 10 }, products.token))).toEqual(["Visible"]);
  });

  it("looks a page up by id or slug and hides invisible ones", async () => {
    const admin = await createStaff(db, ["MANAGE_PAGES"]);
    const visible = await mustCreate({ title: "Visible", isPublished: true });
    const draft = await mustCreate({ title: "Draft" });

    const byId = await client.gql(QUERY, { id: pageId(visible.id) });
    expect(byId.body.errors).toBeUndefined();
    expect(byId.body.data).toMatchObject({
      page: { id: pageId(visible.id), slug: visible.slug, isPublished: true },
    });

    const bySlug = await client.gql(QUERY, { slug: visible.slug });
    expect(bySlug.body.data).toMatchObject({ page: { id: pageId(visible.id) } });

    const hidden = await client.gql(QUERY, { id: pageId(draft.id) });
    expect(hidden.body.data).toEqual({ page: null });
    const hiddenSlug = await client.gql(QUERY, { slug: draft.slug });
    expect(hiddenSlug.body.data).toEqual({ page: null });

    const asStaff = await client.gql(QUERY, { slug: draft.slug }, admin.token);
    expect(asStaff.body.data).toMatchObject({ page: { id: pageId(draft.id) } });

    const unknownId = await client.gql(QUERY, { id: pageId(crypto.randomUUID()) });
    expect(unknownId.body.data).toEqual({ page: null });
    const unknownSlug = await client.gql(QUERY, { slug: "unknown" });
    expect(unknownSlug.body.data).toEqual({ page: null });
  });

  it("requires exactly one of id and slug and uses Saleor's errors", async () => {
    const neither = await client.gql(QUERY);
    expect(errorOf(neither)).toBe("At least one of arguments is required: 'id', 'slug'.");

    const both = await client.gql(QUERY, { id: pageId(crypto.randomUUID()), slug: "about" });
    expect(errorOf(both)).toBe("Argument 'id' cannot be combined with 'slug'");

    const malformed = await client.gql(QUERY, { id: "nope" });
    expect(errorOf(malformed)).toBe("Couldn't resolve id: nope.");

    const wrongType = toGlobalId("Product", crypto.randomUUID());
    const result = await client.gql(QUERY, { id: wrongType });
    expect(errorOf(result)).toBe(`Invalid ID: ${wrongType}. Expected: Page, received: Product.`);
  });

  it("searches, sorts and paginates with totalCount", async () => {
    const alpha = await mustCreate({ title: "Alpha", isPublished: true });
    await mustCreate({ title: "Beta", isPublished: true });
    await mustCreate({ title: "Gamma", isPublished: true });

    const first = await pages({ first: 2, sortBy: { field: "TITLE", direction: "ASC" } });
    expect(pageNames(first)).toEqual(["Alpha", "Beta"]);
    expect(first.totalCount).toBe(3);
    expect(first.pageInfo.hasNextPage).toBe(true);

    const second = await pages({
      first: 2,
      after: first.pageInfo.endCursor,
      sortBy: { field: "TITLE", direction: "ASC" },
    });
    expect(pageNames(second)).toEqual(["Gamma"]);
    expect(second.pageInfo.hasPreviousPage).toBe(true);

    const lastPage = await pages({ last: 1, sortBy: { field: "TITLE", direction: "ASC" } });
    expect(pageNames(lastPage)).toEqual(["Gamma"]);

    const bySlug = await pages({ first: 10, sortBy: { field: "SLUG", direction: "DESC" } });
    expect(pageNames(bySlug)).toEqual(["Gamma", "Beta", "Alpha"]);

    expect(pageNames(await pages({ first: 10, filter: { search: "a" } }))).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);

    expect(pageNames(await pages({ first: 10, filter: { ids: [pageId(alpha.id)] } }))).toEqual([
      "Alpha",
    ]);
  });

  it("refuses Saleor's invalid arguments and cursors", async () => {
    await mustCreate({ title: "Alpha", isPublished: true });

    expect(errorOf(await client.gql(PAGES, {}))).toBe(
      "You must provide a `first` or `last` value to properly paginate the `pages` connection.",
    );
    expect(errorOf(await client.gql(PAGES, { first: 101 }))).toBe(
      "Requesting 101 records on the `pages` connection exceeds the `first` limit of 100 records.",
    );
    expect(errorOf(await client.gql(PAGES, { first: 5, after: "garbage" }))).toBe(
      "Received cursor is invalid.",
    );

    const malformedId = await client.gql(PAGES, { first: 5, filter: { ids: ["garbage"] } });
    expect(errorOf(malformedId)).toBe("Couldn't resolve id: garbage.");
  });

  it("supports asking for totalCount alone", async () => {
    await mustCreate({ title: "Alpha", isPublished: true });

    const result = await client.gql(`query { pages { totalCount } }`);
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({ pages: { totalCount: 1 } });
  });
});
