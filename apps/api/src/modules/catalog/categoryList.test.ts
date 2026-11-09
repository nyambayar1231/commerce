import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type GqlResult } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// GraphQL contract for `categories` and `Category.children` (Saleor's countable connections),
// through the real app and the real (test) DB. Categories are public: no session needed.
const db = getDb();
const client = createTestClient(db);

// 25 top-level categories "Cat 01".."Cat 25"; "Cat 01" has 3 children, "Cat 02" has 1 child,
// "Cat 03" has 1 grandchild via its child. 30 rows in all.
const ids = new Map<string, string>();

beforeAll(async () => {
  await db.$client.unsafe("TRUNCATE category CASCADE");
  for (let i = 1; i <= 25; i += 1) {
    const name = `Cat ${String(i).padStart(2, "0")}`;
    const [row] = await db
      .insert(schema.category)
      .values({
        name,
        slug: name.toLowerCase().replace(" ", "-"),
        descriptionPlaintext: i === 7 ? "winter boots" : "",
      })
      .returning({ id: schema.category.id });
    if (!row) throw new Error("no row");
    ids.set(name, row.id);
  }
  const child = async (name: string, parent: string) => {
    const [row] = await db
      .insert(schema.category)
      .values({ name, slug: name.toLowerCase().replaceAll(" ", "-"), parentId: ids.get(parent) })
      .returning({ id: schema.category.id });
    if (!row) throw new Error("no row");
    ids.set(name, row.id);
  };
  await child("Child A", "Cat 01");
  await child("Child B", "Cat 01");
  await child("Child C", "Cat 01");
  await child("Child D", "Cat 02");
  await child("Child E", "Cat 03");
  await child("Grandchild", "Child E");
});

afterAll(async () => {
  await db.$client.unsafe("TRUNCATE category CASCADE");
  await closeDb();
});

const CATEGORIES = `query ($first: Int, $last: Int, $after: String, $before: String, $sortBy: CategorySortingInput, $level: Int, $filter: CategoryFilterInput) {
  categories(first: $first, last: $last, after: $after, before: $before, sortBy: $sortBy, level: $level, filter: $filter) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges { cursor node { name level } }
  }
}`;

type Page = {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: { cursor: string; node: { name: string; level: number } }[];
};

async function categories(variables: object): Promise<Page> {
  const result = await client.gql(CATEGORIES, variables);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { categories: Page }).categories;
}

const names = (page: Page) => page.edges.map((edge) => edge.node.name);
const errorOf = (result: GqlResult) => result.body.errors?.[0]?.message;

describe("categories", () => {
  it("walks forward through every top-level category by name, without gaps or overlaps", async () => {
    const seen: string[] = [];
    let after: string | null = null;
    let pages = 0;
    for (;;) {
      const page: Page = await categories({ first: 10, after, level: 0 });
      pages += 1;
      expect(page.totalCount).toBe(25);
      expect(page.pageInfo.hasPreviousPage).toBe(after !== null);
      seen.push(...names(page));
      if (!page.pageInfo.hasNextPage) break;
      after = page.pageInfo.endCursor;
    }
    expect(pages).toBe(3);
    expect(seen).toEqual(
      Array.from({ length: 25 }, (_, i) => `Cat ${String(i + 1).padStart(2, "0")}`),
    );
  });

  it("walks backward with last/before and returns pages in order", async () => {
    const lastPage = await categories({ last: 10, level: 0 });
    expect(names(lastPage)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Cat ${String(i + 16).padStart(2, "0")}`),
    );
    expect(lastPage.pageInfo).toMatchObject({ hasPreviousPage: true, hasNextPage: false });

    const previous = await categories({
      last: 10,
      before: lastPage.pageInfo.startCursor,
      level: 0,
    });
    expect(names(previous)[0]).toBe("Cat 06");
    expect(names(previous).at(-1)).toBe("Cat 15");
    expect(previous.pageInfo).toMatchObject({ hasPreviousPage: true, hasNextPage: true });
  });

  it("sorts descending, and by subcategory count with ties broken stably", async () => {
    const desc = await categories({
      first: 3,
      level: 0,
      sortBy: { field: "NAME", direction: "DESC" },
    });
    expect(names(desc)).toEqual(["Cat 25", "Cat 24", "Cat 23"]);

    const byCount = await categories({
      first: 3,
      level: 0,
      sortBy: { field: "SUBCATEGORY_COUNT", direction: "DESC" },
    });
    expect(names(byCount)[0]).toBe("Cat 01");
    const rest = await categories({
      first: 30,
      after: byCount.pageInfo.endCursor,
      level: 0,
      sortBy: { field: "SUBCATEGORY_COUNT", direction: "DESC" },
    });
    // Pages join up exactly: 25 distinct top-level categories in all.
    expect(new Set([...names(byCount), ...names(rest)]).size).toBe(25);
    expect(names(byCount).length + names(rest).length).toBe(25);
  });

  it("lists every level without `level`, with each category's depth", async () => {
    const all = await categories({ first: 100 });
    expect(all.totalCount).toBe(31);
    const depth = Object.fromEntries(all.edges.map((e) => [e.node.name, e.node.level]));
    expect(depth).toMatchObject({ "Cat 01": 0, "Child A": 1, Grandchild: 2 });
  });

  it("searches name, slug and description text", async () => {
    expect(names(await categories({ first: 10, filter: { search: "child" } }))).toEqual([
      "Child A",
      "Child B",
      "Child C",
      "Child D",
      "Child E",
      "Grandchild",
    ]);
    expect(names(await categories({ first: 10, filter: { search: "WINTER" } }))).toEqual([
      "Cat 07",
    ]);
    expect(names(await categories({ first: 10, filter: { search: "100%" } }))).toEqual([]);
  });

  it("returns an empty page with null cursors", async () => {
    const page = await categories({ first: 10, filter: { search: "nothing like this" } });
    expect(page).toEqual({
      totalCount: 0,
      pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
      edges: [],
    });
  });

  it("refuses Saleor's invalid arguments and cursors", async () => {
    expect(errorOf(await client.gql(CATEGORIES, {}))).toBe(
      "You must provide a `first` or `last` value to properly paginate the `categories` connection.",
    );
    expect(errorOf(await client.gql(CATEGORIES, { first: 101 }))).toBe(
      "Requesting 101 records on the `categories` connection exceeds the `first` limit of 100 records.",
    );
    expect(errorOf(await client.gql(CATEGORIES, { first: 5, after: "garbage" }))).toBe(
      "Received cursor is invalid.",
    );
    const tampered = Buffer.from(JSON.stringify(["Cat 01", "not-a-uuid"])).toString("base64");
    expect(errorOf(await client.gql(CATEGORIES, { first: 5, after: tampered }))).toBe(
      "Received cursor is invalid.",
    );
    const badCount = Buffer.from(JSON.stringify(["x", ids.get("Cat 01")])).toString("base64");
    expect(
      errorOf(
        await client.gql(CATEGORIES, {
          first: 5,
          after: badCount,
          sortBy: { field: "SUBCATEGORY_COUNT", direction: "ASC" },
        }),
      ),
    ).toBe("Received cursor is invalid.");
  });
});

describe("Category.children", () => {
  const CHILDREN = `query ($id: ID!, $first: Int, $after: String) {
    category(id: $id) {
      children(first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        edges { node { name level parent { name } } }
      }
    }
  }`;

  it("pages through a category's direct children by name", async () => {
    const id = toGlobalId("Category", ids.get("Cat 01") ?? "");
    const first = await client.gql(CHILDREN, { id, first: 2 });
    const page = (first.body.data as { category: { children: Page } }).category.children;
    expect(page.totalCount).toBe(3);
    expect(page.edges.map((e) => e.node)).toEqual([
      { name: "Child A", level: 1, parent: { name: "Cat 01" } },
      { name: "Child B", level: 1, parent: { name: "Cat 01" } },
    ]);
    const next = await client.gql(CHILDREN, { id, first: 2, after: page.pageInfo.endCursor });
    const rest = (next.body.data as { category: { children: Page } }).category.children;
    expect(names(rest)).toEqual(["Child C"]);
    expect(rest.pageInfo.hasNextPage).toBe(false);
  });

  it("does not include grandchildren", async () => {
    const id = toGlobalId("Category", ids.get("Cat 03") ?? "");
    const result = await client.gql(CHILDREN, { id, first: 10 });
    const page = (result.body.data as { category: { children: Page } }).category.children;
    expect(names(page)).toEqual(["Child E"]);
  });
});
