import { closeDb, createDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, type GqlResult } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// GraphQL contract for `Collection.products`, `Product.collections` and the `sortBy`/`where`
// arguments of `Category.products` (Saleor's resolve_products and resolve_collections), through
// the real app and the real (test) database. The `collections` list is answered by a per-request
// DataLoader, so the last test counts the SQL statements postgres.js sends.

const db = getDb();
const counted: string[] = [];
const countingDb = createDb(databaseUrl(), { onQuery: (statement) => counted.push(statement) });
const client = createTestClient(countingDb);

/** postgres.js introspects array types on each new connection; those are driver queries. */
const domainQueries = () =>
  counted.filter((statement) => !statement.includes("pg_catalog.pg_type"));

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see apps/api/vitest.config.ts)");
  return url;
}

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const productId = (n: number) => ID(n);
const productName = (n: number) => `Prod ${String(n).padStart(2, "0")}`;

const BOOTS = ID(200);
const WINTER = ID(201);
const HATS = ID(202);

const FEATURED = ID(300);
const SALE = ID(301);
const HIDDEN = ID(302);

// Boots > Winter, plus Hats. P04 has no category. P05 is unpublished and P06 is published in the
// future, so the public never sees them; staff with MANAGE_PRODUCTS do.
const PRODUCTS: {
  n: number;
  categoryId: string | null;
  price: number;
  isPublished: boolean;
  publishedAt?: string;
  collections: string[];
}[] = [
  {
    n: 1,
    categoryId: BOOTS,
    price: 3000,
    isPublished: true,
    collections: [FEATURED, SALE],
  },
  { n: 2, categoryId: WINTER, price: 2000, isPublished: true, collections: [FEATURED] },
  { n: 3, categoryId: BOOTS, price: 5000, isPublished: true, collections: [SALE] },
  { n: 4, categoryId: null, price: 1000, isPublished: true, collections: [FEATURED, HIDDEN] },
  { n: 5, categoryId: BOOTS, price: 400, isPublished: false, collections: [FEATURED] },
  {
    n: 6,
    categoryId: WINTER,
    price: 300,
    isPublished: true,
    publishedAt: "2999-01-01T00:00:00Z",
    collections: [FEATURED],
  },
];

const COLLECTIONS = [
  { id: FEATURED, name: "Featured", slug: "featured", isPublished: true },
  { id: SALE, name: "Sale", slug: "sale", isPublished: true },
  { id: HIDDEN, name: "Hidden", slug: "hidden", isPublished: false },
];

async function seed(): Promise<void> {
  await db.insert(schema.category).values([
    { id: BOOTS, name: "Boots", slug: "boots" },
    { id: WINTER, name: "Winter", slug: "winter", parentId: BOOTS },
    { id: HATS, name: "Hats", slug: "hats" },
  ]);
  await db.insert(schema.collection).values(COLLECTIONS);
  for (const product of PRODUCTS) {
    await db.insert(schema.product).values({
      id: productId(product.n),
      name: productName(product.n),
      slug: `prod-${String(product.n).padStart(2, "0")}`,
      categoryId: product.categoryId,
      isPublished: product.isPublished,
      publishedAt: product.publishedAt === undefined ? null : new Date(product.publishedAt),
    });
    await db.insert(schema.productVariant).values({
      productId: productId(product.n),
      name: "Default",
      sku: `SKU-${product.n}`,
      priceAmount: product.price,
      currency: "MNT",
      position: 0,
    });
    if (product.collections.length > 0) {
      await db.insert(schema.collectionProduct).values(
        product.collections.map((collectionId) => ({
          collectionId,
          productId: productId(product.n),
        })),
      );
    }
  }
}

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, category, collection, product CASCADE',
  );
  await seed();
});

afterAll(async () => {
  await countingDb.$client.end({ timeout: 5 });
  await closeDb();
});

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

const names = (page: Page) => page.edges.map((edge) => edge.node.name);
const errorOf = (result: GqlResult) => result.body.errors?.[0]?.message;

const COLLECTION_PRODUCTS = `query ($slug: String!, $first: Int, $last: Int, $after: String, $before: String, $search: String, $sortBy: ProductOrder, $where: ProductWhereInput) {
  collection(slug: $slug) {
    name
    products(first: $first, last: $last, after: $after, before: $before, search: $search, sortBy: $sortBy, where: $where) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      edges { cursor node { name } }
    }
  }
}`;

async function collectionProducts(variables: object, token?: string): Promise<Page> {
  const result = await client.gql(COLLECTION_PRODUCTS, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { collection: { products: Page } }).collection.products;
}

describe("Collection.products", () => {
  it("lists only the collection's published products, sorted by the requested field", async () => {
    // Featured holds P01 (3000), P02 (2000), P04 (1000), plus P05 (unpublished) and P06 (future).
    const page = await collectionProducts({
      slug: "featured",
      first: 100,
      sortBy: { field: "PRICE", direction: "ASC" },
    });
    expect(page.totalCount).toBe(3);
    expect(names(page)).toEqual([4, 2, 1].map(productName));

    const byName = await collectionProducts({ slug: "featured", first: 100 });
    expect(names(byName)).toEqual([1, 2, 4].map(productName));
  });

  it("filters with where, and an empty list matches nothing", async () => {
    const featured = (where: object) => collectionProducts({ slug: "featured", first: 100, where });

    const priced = await featured({ price: { range: { gte: 2000 } } });
    expect(priced.totalCount).toBe(2);
    expect(names(priced)).toEqual([1, 2].map(productName));

    const categorized = await featured({ category: { eq: toGlobalId("Category", BOOTS) } });
    // Boots' subtree includes Winter, so both of Featured's categorized products match.
    expect(names(categorized)).toEqual([1, 2].map(productName));

    expect((await featured({ name: { oneOf: [] } })).edges).toEqual([]);
  });

  it("searches within the collection", async () => {
    const page = await collectionProducts({ slug: "featured", first: 100, search: "prod 04" });
    expect(names(page)).toEqual([productName(4)]);
  });

  it("pages forward and backward with Saleor's cursor rules", async () => {
    const sortBy = { field: "PRICE", direction: "ASC" };
    const first = await collectionProducts({ slug: "featured", first: 2, sortBy });
    expect(names(first)).toEqual([4, 2].map(productName));
    expect(first.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });

    const rest = await collectionProducts({
      slug: "featured",
      first: 2,
      after: first.pageInfo.endCursor,
      sortBy,
    });
    expect(names(rest)).toEqual([productName(1)]);
    expect(rest.totalCount).toBe(3);
    expect(rest.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: true });

    const last = await collectionProducts({ slug: "featured", last: 2, sortBy });
    expect(names(last)).toEqual([2, 1].map(productName));
    expect(last.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: true });
  });

  it("shows unpublished products and collections to staff with MANAGE_PRODUCTS", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    // The collection itself is hidden from the public (M15.4a) ...
    const hidden = await client.gql(`query ($slug: String!) { collection(slug: $slug) { name } }`, {
      slug: "hidden",
    });
    expect(hidden.body.data).toEqual({ collection: null });
    // ... and visible to staff, with its products.
    const hiddenForStaff = await collectionProducts({ slug: "hidden", first: 100 }, admin.token);
    expect(names(hiddenForStaff)).toEqual([productName(4)]);

    const all = await collectionProducts(
      {
        slug: "featured",
        first: 100,
        sortBy: { field: "NAME", direction: "ASC" },
      },
      admin.token,
    );
    expect(all.totalCount).toBe(5);
    expect(names(all)).toEqual([1, 2, 4, 5, 6].map(productName));
  });

  it("refuses invalid pagination and cursors like the products query", async () => {
    expect(errorOf(await client.gql(COLLECTION_PRODUCTS, { slug: "featured" }))).toBe(
      "You must provide a `first` or `last` value to properly paginate the `products` connection.",
    );
    expect(errorOf(await client.gql(COLLECTION_PRODUCTS, { slug: "featured", first: 101 }))).toBe(
      "Requesting 101 records on the `products` connection exceeds the `first` limit of 100 records.",
    );
    expect(
      errorOf(await client.gql(COLLECTION_PRODUCTS, { slug: "featured", first: 2, after: "bad" })),
    ).toBe("Received cursor is invalid.");
  });

  it("answers totalCount without first or last when edges are not selected", async () => {
    const result = await client.gql(
      `query ($slug: String!) { collection(slug: $slug) { products { totalCount } } }`,
      { slug: "featured" },
    );
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({ collection: { products: { totalCount: 3 } } });
  });
});

const CATEGORY_PRODUCTS = `query ($slug: String!, $first: Int, $search: String, $sortBy: ProductOrder, $where: ProductWhereInput) {
  category(slug: $slug) {
    products(first: $first, search: $search, sortBy: $sortBy, where: $where) {
      totalCount
      edges { node { name } }
    }
  }
}`;

async function categoryProducts(variables: object, token?: string): Promise<Page> {
  const result = await client.gql(CATEGORY_PRODUCTS, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { category: { products: Page } }).category.products;
}

describe("Category.products sorted and filtered", () => {
  it("sorts and filters the subtree's products", async () => {
    // Boots' subtree holds P01 (3000), P02 (2000, Winter) and P03 (5000); P05 is unpublished.
    const descending = await categoryProducts({
      slug: "boots",
      first: 100,
      sortBy: { field: "PRICE", direction: "DESC" },
    });
    expect(descending.totalCount).toBe(3);
    expect(names(descending)).toEqual([3, 1, 2].map(productName));

    const featured = await categoryProducts({
      slug: "boots",
      first: 100,
      where: { collection: { eq: toGlobalId("Collection", FEATURED) } },
    });
    expect(featured.totalCount).toBe(2);
    expect(names(featured)).toEqual([1, 2].map(productName));
  });

  it("keeps the list row's totalCount shortcut only without search and where", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const CATEGORIES = `query ($search: String, $where: ProductWhereInput) {
      categories(first: 10) {
        edges { node { name products(search: $search, where: $where) { totalCount } } }
      }
    }`;
    type CategoryPage = {
      edges: { node: { name: string; products: { totalCount: number } } }[];
    };
    const counts = async (variables: object) => {
      const result = await client.gql(CATEGORIES, variables, admin.token);
      expect(result.body.errors).toBeUndefined();
      return Object.fromEntries(
        (result.body.data as { categories: CategoryPage }).categories.edges.map((edge) => [
          edge.node.name,
          edge.node.products.totalCount,
        ]),
      );
    };

    // The row's count covers the subtree, including the unpublished P05 and the future P06.
    expect(await counts({})).toEqual({ Boots: 5, Winter: 2, Hats: 0 });
    // A where filter must run the real query instead of the shortcut.
    expect(
      await counts({ where: { collection: { eq: toGlobalId("Collection", FEATURED) } } }),
    ).toEqual({ Boots: 4, Winter: 2, Hats: 0 });
    expect(await counts({ search: "prod 03" })).toEqual({ Boots: 1, Winter: 0, Hats: 0 });
  });

  it("still answers the public's visible count", async () => {
    const result = await client.gql(
      `query { categories(first: 10) { edges { node { name products { totalCount } } } } }`,
    );
    expect(result.body.errors).toBeUndefined();
    const categories = (
      result.body.data as {
        categories: { edges: { node: { name: string; products: { totalCount: number } } }[] };
      }
    ).categories;
    expect(
      Object.fromEntries(
        categories.edges.map((edge) => [edge.node.name, edge.node.products.totalCount]),
      ),
    ).toEqual({ Boots: 3, Winter: 1, Hats: 0 });
  });
});

const PRODUCTS_WITH_COLLECTIONS = `query ($first: Int) {
  products(first: $first) {
    edges { node { name collections { name slug } } }
  }
}`;

type ProductPage = {
  edges: { node: { name: string; collections: { name: string; slug: string }[] } }[];
};

const collectionsOf = async (first: number, token?: string) => {
  const result = await client.gql(PRODUCTS_WITH_COLLECTIONS, { first }, token);
  expect(result.body.errors).toBeUndefined();
  const page = (result.body.data as { products: ProductPage }).products;
  return Object.fromEntries(
    page.edges.map((edge) => [
      edge.node.name,
      edge.node.collections.map((collection) => collection.slug),
    ]),
  );
};

describe("Product.collections", () => {
  it("lists the visible collections for the public, sorted by name", async () => {
    expect(await collectionsOf(100)).toEqual({
      "Prod 01": ["featured", "sale"],
      "Prod 02": ["featured"],
      "Prod 03": ["sale"],
      "Prod 04": ["featured"],
    });
  });

  it("lists the unpublished collections for staff", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(await collectionsOf(100, admin.token)).toEqual({
      "Prod 01": ["featured", "sale"],
      "Prod 02": ["featured"],
      "Prod 03": ["sale"],
      "Prod 04": ["featured", "hidden"],
      "Prod 05": ["featured"],
      "Prod 06": ["featured"],
    });
  });

  it("batches a page's collections into one query", async () => {
    const plain = `query { products(first: 20) { edges { node { name } } } }`;
    const withCollections = `query { products(first: 20) { edges { node { name collections { name } } } } }`;

    // Warm the connection up, then count the two shapes.
    await client.gql(plain);
    counted.length = 0;
    expect((await client.gql(plain)).body.errors).toBeUndefined();
    const plainQueries = domainQueries();

    counted.length = 0;
    expect((await client.gql(withCollections)).body.errors).toBeUndefined();
    expect(domainQueries()).toHaveLength(plainQueries.length + 1);
  });
});
