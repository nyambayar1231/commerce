import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, type GqlResult } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// GraphQL contract for `Category.products` and the `PRODUCT_COUNT` category sort (Saleor's
// resolve_products and CategorySortField.qs_with_product_count), through the real app and the
// real (test) database.

const db = getDb();
const client = createTestClient(db);

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CATEGORY = {
  root: ID(200),
  child: ID(201),
  grandchild: ID(202),
  sibling: ID(203),
  hats: ID(204),
  empty: ID(205),
} as const;

// Shoes > Boots > Winter, with Sandals as Boots' sibling. Hats and Empty sit outside the Shoes
// subtree. Counts are cumulative over the subtree and include unpublished products (`Winter`
// holds Product 3 and the unpublished Product 7).
const CATEGORY_COUNTS: Record<string, number> = {
  Shoes: 6,
  Boots: 4,
  Winter: 2,
  Sandals: 1,
  Hats: 1,
  Empty: 0,
};

const productId = (n: number) => ID(n);
const productName = (n: number) => `Prod ${String(n).padStart(2, "0")}`;

async function seed(): Promise<void> {
  await db.insert(schema.category).values([
    { id: CATEGORY.root, name: "Shoes", slug: "shoes" },
    { id: CATEGORY.child, name: "Boots", slug: "boots", parentId: CATEGORY.root },
    { id: CATEGORY.grandchild, name: "Winter", slug: "winter", parentId: CATEGORY.child },
    { id: CATEGORY.sibling, name: "Sandals", slug: "sandals", parentId: CATEGORY.root },
    { id: CATEGORY.hats, name: "Hats", slug: "hats" },
    { id: CATEGORY.empty, name: "Empty", slug: "empty" },
  ]);

  const products: {
    n: number;
    categoryId: string | null;
    isPublished: boolean;
    publishedAt?: string;
  }[] = [
    { n: 1, categoryId: CATEGORY.root, isPublished: true },
    { n: 2, categoryId: CATEGORY.child, isPublished: true },
    { n: 3, categoryId: CATEGORY.grandchild, isPublished: true },
    { n: 4, categoryId: CATEGORY.sibling, isPublished: true },
    { n: 5, categoryId: CATEGORY.hats, isPublished: true },
    { n: 6, categoryId: null, isPublished: true },
    { n: 7, categoryId: CATEGORY.grandchild, isPublished: false },
    { n: 8, categoryId: CATEGORY.child, isPublished: true, publishedAt: "2999-01-01T00:00:00Z" },
  ];
  for (const { n, publishedAt, ...rest } of products) {
    await db.insert(schema.product).values({
      id: productId(n),
      name: productName(n),
      slug: `prod-${String(n).padStart(2, "0")}`,
      publishedAt: publishedAt === undefined ? null : new Date(publishedAt),
      ...rest,
    });
  }
}

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await seed();
});

afterAll(async () => {
  await closeDb();
});

const CATEGORY_PRODUCTS = `query ($id: ID!, $first: Int, $last: Int, $after: String, $before: String, $search: String) {
  category(id: $id) {
    products(first: $first, last: $last, after: $after, before: $before, search: $search) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      edges { cursor node { name } }
    }
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
  edges: { cursor: string; node: { name: string } }[];
};

const rootId = () => toGlobalId("Category", CATEGORY.root);

async function products(variables: object, token?: string): Promise<Page> {
  const result = await client.gql(CATEGORY_PRODUCTS, { id: rootId(), ...variables }, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { category: { products: Page } }).category.products;
}

const names = (page: Page) => page.edges.map((edge) => edge.node.name);
const errorOf = (result: GqlResult) => result.body.errors?.[0]?.message;

describe("Category.products", () => {
  it("lists the category's products and all descendants', not siblings'", async () => {
    const root = await products({ first: 100 });
    expect(root.totalCount).toBe(4);
    expect(names(root)).toEqual([1, 2, 3, 4].map(productName));

    const child = await client.gql(CATEGORY_PRODUCTS, {
      id: toGlobalId("Category", CATEGORY.child),
      first: 100,
    });
    expect(
      (child.body.data as { category: { products: Page } }).category.products.edges.map(
        (edge) => edge.node.name,
      ),
    ).toEqual([2, 3].map(productName));

    const grandchild = await client.gql(CATEGORY_PRODUCTS, {
      id: toGlobalId("Category", CATEGORY.grandchild),
      first: 100,
    });
    expect(
      (grandchild.body.data as { category: { products: Page } }).category.products.edges.map(
        (edge) => edge.node.name,
      ),
    ).toEqual([productName(3)]);
  });

  it("applies the same visibility as `products`: anonymous, staff without and with MANAGE_PRODUCTS", async () => {
    expect(names(await products({ first: 100 }))).toEqual([1, 2, 3, 4].map(productName));

    const otherStaff = await createStaff(db, ["MANAGE_ORDERS"]);
    expect(names(await products({ first: 100 }, otherStaff.token))).toEqual(
      [1, 2, 3, 4].map(productName),
    );

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const all = await products({ first: 100 }, admin.token);
    expect(all.totalCount).toBe(6);
    expect(names(all)).toEqual([1, 2, 3, 4, 7, 8].map(productName));
  });

  it("searches within the subtree", async () => {
    expect(names(await products({ first: 100, search: "prod 03" }))).toEqual([productName(3)]);
    expect(names(await products({ first: 100, search: "prod 05" }))).toEqual([]);
  });

  it("pages forward and backward with Saleor's cursor rules", async () => {
    const first = await products({ first: 2 });
    expect(names(first)).toEqual([1, 2].map(productName));
    expect(first.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });

    const next = await products({ first: 2, after: first.pageInfo.endCursor });
    expect(names(next)).toEqual([3, 4].map(productName));
    expect(next.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: true });

    const last = await products({ last: 2 });
    expect(names(last)).toEqual([3, 4].map(productName));
    expect(last.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: true });

    const previous = await products({ last: 2, before: last.pageInfo.startCursor });
    expect(names(previous)).toEqual([1, 2].map(productName));
    expect(previous.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
  });

  it("answers totalCount without first or last when edges are not selected", async () => {
    const result = await client.gql(
      `query ($id: ID!) { category(id: $id) { products { totalCount } } }`,
      { id: rootId() },
    );
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({ category: { products: { totalCount: 4 } } });
  });

  it("refuses the same invalid arguments and cursors as `products`", async () => {
    expect(errorOf(await client.gql(CATEGORY_PRODUCTS, { id: rootId() }))).toBe(
      "You must provide a `first` or `last` value to properly paginate the `products` connection.",
    );
    expect(errorOf(await client.gql(CATEGORY_PRODUCTS, { id: rootId(), first: 101 }))).toBe(
      "Requesting 101 records on the `products` connection exceeds the `first` limit of 100 records.",
    );
    expect(errorOf(await client.gql(CATEGORY_PRODUCTS, { id: rootId(), first: -1 }))).toBe(
      'Argument "first" must be a non-negative integer',
    );
    expect(
      errorOf(await client.gql(CATEGORY_PRODUCTS, { id: rootId(), first: 5, after: "garbage" })),
    ).toBe("Received cursor is invalid.");
    const tampered = Buffer.from(JSON.stringify(["Prod 01", "not-a-uuid"])).toString("base64");
    expect(
      errorOf(await client.gql(CATEGORY_PRODUCTS, { id: rootId(), first: 5, after: tampered })),
    ).toBe("Received cursor is invalid.");
  });
});

const CATEGORIES = `query ($first: Int, $last: Int, $after: String, $before: String, $sortBy: CategorySortingInput) {
  categories(first: $first, last: $last, after: $after, before: $before, sortBy: $sortBy) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges { cursor node { id name products { totalCount } } }
  }
}`;

type CategoryPage = {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: { cursor: string; node: { id: string; name: string; products: { totalCount: number } } }[];
};

async function categories(variables: object, token?: string): Promise<CategoryPage> {
  const result = await client.gql(CATEGORIES, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { categories: CategoryPage }).categories;
}

const CATEGORY_IDS: Record<string, string> = {
  Shoes: CATEGORY.root,
  Boots: CATEGORY.child,
  Winter: CATEGORY.grandchild,
  Sandals: CATEGORY.sibling,
  Hats: CATEGORY.hats,
  Empty: CATEGORY.empty,
};

/** Expected order: cumulative count, then id, in the same direction (the SQL tie-break). */
function expectedOrder(direction: "ASC" | "DESC"): string[] {
  return Object.entries(CATEGORY_COUNTS)
    .sort(([aName, aCount], [bName, bCount]) => {
      const byCount = direction === "ASC" ? aCount - bCount : bCount - aCount;
      if (byCount !== 0) return byCount;
      const byId = (CATEGORY_IDS[aName] ?? "").localeCompare(CATEGORY_IDS[bName] ?? "");
      return direction === "ASC" ? byId : -byId;
    })
    .map(([name]) => name);
}

describe("categories sorted by PRODUCT_COUNT", () => {
  it("sorts by the cumulative count over the subtree, both directions, with stable ties", async () => {
    const asc = await categories({
      first: 50,
      sortBy: { field: "PRODUCT_COUNT", direction: "ASC" },
    });
    expect(asc.totalCount).toBe(6);
    expect(asc.edges.map((edge) => edge.node.name)).toEqual(expectedOrder("ASC"));

    const desc = await categories({
      first: 50,
      sortBy: { field: "PRODUCT_COUNT", direction: "DESC" },
    });
    expect(desc.edges.map((edge) => edge.node.name)).toEqual(expectedOrder("DESC"));
  });

  it("pages across equal counts without gaps or overlaps", async () => {
    const sortBy = { field: "PRODUCT_COUNT", direction: "ASC" };
    const first = await categories({ first: 2, sortBy });
    expect(first.edges.map((edge) => edge.node.name)).toEqual(expectedOrder("ASC").slice(0, 2));

    const rest = await categories({ first: 50, after: first.pageInfo.endCursor, sortBy });
    expect([...first.edges, ...rest.edges].map((edge) => edge.node.name)).toEqual(
      expectedOrder("ASC"),
    );
  });

  it("rejects an invalid PRODUCT_COUNT cursor", async () => {
    const bad = Buffer.from(JSON.stringify(["x", CATEGORY.root])).toString("base64");
    expect(
      errorOf(
        await client.gql(CATEGORIES, {
          first: 5,
          after: bad,
          sortBy: { field: "PRODUCT_COUNT", direction: "ASC" },
        }),
      ),
    ).toBe("Received cursor is invalid.");
  });
});

describe("a list row's products { totalCount }", () => {
  it("uses the row's cumulative product count for staff who see unpublished products", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const page = await categories({ first: 50 }, admin.token);
    const counts = Object.fromEntries(
      page.edges.map((edge) => [edge.node.name, edge.node.products.totalCount]),
    );
    expect(counts).toMatchObject(CATEGORY_COUNTS);
  });

  it("runs the visible count for callers who do not see unpublished products", async () => {
    const page = await categories({ first: 50 });
    const counts = Object.fromEntries(
      page.edges.map((edge) => [edge.node.name, edge.node.products.totalCount]),
    );
    expect(counts).toEqual({
      Shoes: 4,
      Boots: 2,
      Winter: 1,
      Sandals: 1,
      Hats: 1,
      Empty: 0,
    });
  });

  it("counts all products for staff when the category is loaded on its own", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(
      `query ($id: ID!) { category(id: $id) { products { totalCount } } }`,
      { id: rootId() },
      admin.token,
    );
    expect(result.body.data).toEqual({ category: { products: { totalCount: 6 } } });
  });
});
