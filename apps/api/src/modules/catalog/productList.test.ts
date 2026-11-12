import { closeDb, getDb, schema } from "@commerce/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, type GqlResult } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// GraphQL contract for `products` and `product` (Saleor's Product / ProductVariant types and the
// ProductCountableConnection), through the real app and the real (test) database.

const db = getDb();
const client = createTestClient(db);

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CATEGORY_ID = ID(100);
const name = (n: number) => `Prod ${String(n).padStart(2, "0")}`;

interface VariantFixture {
  position: number;
  name: string;
  sku: string;
  price: number;
}

interface ProductFixture {
  n: number;
  published: boolean;
  publishedAt: string | null;
  category?: boolean;
  descriptionPlaintext?: string;
  variants: VariantFixture[];
}

// P01-P09 are public; P10 and P12 are unpublished; P11 is published with a future date.
const PRODUCTS: ProductFixture[] = [
  {
    n: 1,
    published: true,
    publishedAt: null,
    category: true,
    variants: [
      { position: 1, name: "Small", sku: "SKU-A", price: 3000 },
      { position: 2, name: "Large", sku: "SKU-B", price: 5000 },
    ],
  },
  {
    n: 2,
    published: true,
    publishedAt: "2020-01-01T00:00:00.000Z",
    variants: [{ position: 0, name: "One", sku: "SKU-C", price: 2000 }],
  },
  {
    n: 3,
    published: true,
    publishedAt: null,
    variants: [{ position: 0, name: "One", sku: "SKU-D", price: 1000 }],
  },
  {
    n: 4,
    published: true,
    publishedAt: "2020-01-02T00:00:00.000Z",
    variants: [{ position: 0, name: "One", sku: "SKU-E", price: 4000 }],
  },
  { n: 5, published: true, publishedAt: null, variants: [] },
  {
    n: 6,
    published: true,
    publishedAt: null,
    variants: [{ position: 0, name: "One", sku: "SKU-F", price: 1000 }],
  },
  {
    n: 7,
    published: true,
    publishedAt: null,
    descriptionPlaintext: "winter boots",
    variants: [{ position: 0, name: "One", sku: "SKU-G", price: 4000 }],
  },
  {
    n: 8,
    published: true,
    publishedAt: null,
    variants: [{ position: 0, name: "One", sku: "SKU-H", price: 1000 }],
  },
  {
    n: 9,
    published: true,
    publishedAt: null,
    variants: [{ position: 0, name: "One", sku: "SKU-I", price: 4000 }],
  },
  {
    n: 10,
    published: false,
    publishedAt: null,
    variants: [{ position: 0, name: "Hidden", sku: "SKU-HIDDEN", price: 100 }],
  },
  {
    n: 11,
    published: true,
    publishedAt: "2999-01-01T00:00:00.000Z",
    variants: [{ position: 0, name: "Future", sku: "SKU-FUTURE", price: 200 }],
  },
  { n: 12, published: false, publishedAt: null, variants: [] },
];

async function seed(): Promise<void> {
  await db.insert(schema.category).values({ id: CATEGORY_ID, name: "Boots", slug: "boots" });
  for (const product of PRODUCTS) {
    await db.insert(schema.product).values({
      id: ID(product.n),
      name: name(product.n),
      slug: `prod-${String(product.n).padStart(2, "0")}`,
      description: product.n === 7 ? { blocks: [{ data: { text: "winter boots" } }] } : null,
      descriptionPlaintext: product.descriptionPlaintext ?? "",
      categoryId: product.category ? CATEGORY_ID : null,
      isPublished: product.published,
      publishedAt: product.publishedAt === null ? null : new Date(product.publishedAt),
      createdAt: new Date(Date.UTC(2024, 0, product.n)),
      updatedAt: new Date(Date.UTC(2024, 5, 14 - product.n)),
    });
    for (const variant of product.variants) {
      await db.insert(schema.productVariant).values({
        productId: ID(product.n),
        name: variant.name,
        sku: variant.sku,
        priceAmount: variant.price,
        currency: "MNT",
        position: variant.position,
      });
    }
  }
}

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await seed();
});

afterAll(async () => {
  await closeDb();
});

const PRODUCTS_QUERY = `query ($first: Int, $last: Int, $after: String, $before: String, $sortBy: ProductOrder, $search: String) {
  products(first: $first, last: $last, after: $after, before: $before, sortBy: $sortBy, search: $search) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges {
      cursor
      node {
        id name slug isPublished publishedAt created updatedAt
        minimalVariantPrice { amount currency }
      }
    }
  }
}`;

type MoneyData = { amount: number; currency: string };

type ProductNode = {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  publishedAt: string | null;
  created: string;
  updatedAt: string;
  minimalVariantPrice: MoneyData | null;
};

type Page = {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  edges: { cursor: string; node: ProductNode }[];
};

async function products(variables: object, token?: string): Promise<Page> {
  const result = await client.gql(PRODUCTS_QUERY, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { products: Page }).products;
}

const names = (page: Page) => page.edges.map((edge) => edge.node.name);
const errorOf = (result: GqlResult) => result.body.errors?.[0]?.message;
const sort = async (field: string, direction: "ASC" | "DESC", token?: string) =>
  names(await products({ first: 100, sortBy: { field, direction } }, token));

describe("products", () => {
  it("walks forward through every public product without gaps or overlaps", async () => {
    const seen: string[] = [];
    let after: string | null = null;
    let pages = 0;
    for (;;) {
      const page: Page = await products({ first: 4, after });
      pages += 1;
      expect(page.totalCount).toBe(9);
      expect(page.pageInfo.hasPreviousPage).toBe(after !== null);
      seen.push(...names(page));
      if (!page.pageInfo.hasNextPage) break;
      after = page.pageInfo.endCursor;
    }
    expect(pages).toBe(3);
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(name));
  });

  it("walks backward with last/before and returns pages in order", async () => {
    const last = await products({ last: 4 });
    expect(names(last)).toEqual([6, 7, 8, 9].map(name));
    expect(last.pageInfo).toMatchObject({ hasPreviousPage: true, hasNextPage: false });

    const previous = await products({ last: 4, before: last.pageInfo.startCursor });
    expect(names(previous)).toEqual([2, 3, 4, 5].map(name));
    expect(previous.pageInfo).toMatchObject({ hasPreviousPage: true, hasNextPage: true });

    const first = await products({ last: 4, before: previous.pageInfo.startCursor });
    expect(names(first)).toEqual([name(1)]);
    expect(first.pageInfo).toMatchObject({ hasPreviousPage: false, hasNextPage: true });
  });

  it("sorts by every field in both directions, tie-breaking by id", async () => {
    expect(await sort("NAME", "ASC")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(name));
    expect(await sort("NAME", "DESC")).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1].map(name));

    // Products without variants first ascending (COALESCE -1), then 1000/2000/3000/4000 ties by id.
    expect(await sort("PRICE", "ASC")).toEqual([5, 3, 6, 8, 2, 1, 4, 7, 9].map(name));
    expect(await sort("PRICE", "DESC")).toEqual([9, 7, 4, 1, 2, 8, 6, 3, 5].map(name));

    expect(await sort("PUBLISHED", "ASC")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(name));
    expect(await sort("PUBLISHED", "DESC")).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1].map(name));

    expect(await sort("CREATED_AT", "ASC")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(name));
    expect(await sort("CREATED_AT", "DESC")).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1].map(name));

    expect(await sort("LAST_MODIFIED_AT", "ASC")).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1].map(name));
    expect(await sort("LAST_MODIFIED_AT", "DESC")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(name));
  });

  it("pages across equal sort values without gaps or overlaps", async () => {
    const sortBy = { field: "PRICE", direction: "ASC" };
    const first = await products({ first: 4, sortBy });
    expect(names(first)).toEqual([5, 3, 6, 8].map(name));

    const rest = await products({ first: 100, after: first.pageInfo.endCursor, sortBy });
    expect(names(rest)).toEqual([2, 1, 4, 7, 9].map(name));
  });

  it("pages with timestamp and publication cursors", async () => {
    const byUpdate = { field: "LAST_MODIFIED_AT", direction: "ASC" };
    const first = await products({ first: 4, sortBy: byUpdate });
    expect(names(first)).toEqual([9, 8, 7, 6].map(name));
    const rest = await products({ first: 100, after: first.pageInfo.endCursor, sortBy: byUpdate });
    expect(names(rest)).toEqual([5, 4, 3, 2, 1].map(name));

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const byPublished = { field: "PUBLISHED", direction: "ASC" };
    const unpublished = await products({ first: 2, sortBy: byPublished }, admin.token);
    expect(names(unpublished)).toEqual([name(10), name(12)]);
    const published = await products(
      { first: 100, after: unpublished.pageInfo.endCursor, sortBy: byPublished },
      admin.token,
    );
    expect(names(published)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 11].map(name));
  });

  it("sorts unpublished products for staff with MANAGE_PRODUCTS", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(await sort("PUBLISHED", "ASC", admin.token)).toEqual(
      [10, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11].map(name),
    );
    expect(await sort("PUBLISHED", "DESC", admin.token)).toEqual(
      [11, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12, 10].map(name),
    );
  });

  it("hides unpublished and future-dated products from the public and from staff without MANAGE_PRODUCTS", async () => {
    expect(names(await products({ first: 100 }))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(name));

    const otherStaff = await createStaff(db, ["MANAGE_ORDERS"]);
    expect(names(await products({ first: 100 }, otherStaff.token))).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(name),
    );

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const all = await products({ first: 100 }, admin.token);
    expect(all.totalCount).toBe(12);
    expect(names(all)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(name));
  });

  it("searches names, slugs, description text and variant SKUs", async () => {
    expect(names(await products({ first: 10, search: "prod 07" }))).toEqual([name(7)]);
    expect(names(await products({ first: 10, search: "WINTER" }))).toEqual([name(7)]);
    expect(names(await products({ first: 10, search: "sku-b" }))).toEqual([name(1)]);
    expect(names(await products({ first: 10, search: "100%" }))).toEqual([]);
  });

  it("answers totalCount without first or last when edges are not selected", async () => {
    const result = await client.gql(`{ products { totalCount } }`);
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({ products: { totalCount: 9 } });
  });

  it("refuses Saleor's invalid arguments and cursors", async () => {
    expect(errorOf(await client.gql(PRODUCTS_QUERY, {}))).toBe(
      "You must provide a `first` or `last` value to properly paginate the `products` connection.",
    );
    expect(errorOf(await client.gql(PRODUCTS_QUERY, { first: 101 }))).toBe(
      "Requesting 101 records on the `products` connection exceeds the `first` limit of 100 records.",
    );
    expect(errorOf(await client.gql(PRODUCTS_QUERY, { first: -1 }))).toBe(
      'Argument "first" must be a non-negative integer',
    );
    expect(errorOf(await client.gql(PRODUCTS_QUERY, { first: 5, after: "garbage" }))).toBe(
      "Received cursor is invalid.",
    );

    const tampered = Buffer.from(JSON.stringify(["Prod 01", "not-a-uuid"])).toString("base64");
    expect(errorOf(await client.gql(PRODUCTS_QUERY, { first: 5, after: tampered }))).toBe(
      "Received cursor is invalid.",
    );

    const badPrice = Buffer.from(JSON.stringify(["abc", ID(1)])).toString("base64");
    expect(
      errorOf(
        await client.gql(PRODUCTS_QUERY, {
          first: 5,
          after: badPrice,
          sortBy: { field: "PRICE", direction: "ASC" },
        }),
      ),
    ).toBe("Received cursor is invalid.");

    const badPublished = Buffer.from(JSON.stringify(["2", ID(1)])).toString("base64");
    expect(
      errorOf(
        await client.gql(PRODUCTS_QUERY, {
          first: 5,
          after: badPublished,
          sortBy: { field: "PUBLISHED", direction: "ASC" },
        }),
      ),
    ).toBe("Received cursor is invalid.");

    const badDate = Buffer.from(JSON.stringify(["not-a-date", ID(1)])).toString("base64");
    expect(
      errorOf(
        await client.gql(PRODUCTS_QUERY, {
          first: 5,
          after: badDate,
          sortBy: { field: "CREATED_AT", direction: "ASC" },
        }),
      ),
    ).toBe("Received cursor is invalid.");
    // The old millisecond ISO cursors (before PLAN M9.5) are refused too.
    const isoCursor = Buffer.from(JSON.stringify(["2026-01-01T00:00:00.000Z", ID(1)])).toString(
      "base64",
    );
    expect(
      errorOf(
        await client.gql(PRODUCTS_QUERY, {
          first: 5,
          after: isoCursor,
          sortBy: { field: "CREATED_AT", direction: "ASC" },
        }),
      ),
    ).toBe("Received cursor is invalid.");
  });

  // PLAN M9.5 (found in M6.1): rows whose timestamps differ only in microseconds repeated page
  // after page when the cursor held milliseconds.
  it("pages by date across rows created within one millisecond", async () => {
    await db.execute(sql`UPDATE product SET
      created_at = '2026-01-01T00:00:00.000Z'::timestamptz + make_interval(secs => n / 1000000.0),
      updated_at = '2026-01-01T00:00:00.000Z'::timestamptz + make_interval(secs => (10 - n) / 1000000.0)
      FROM (VALUES (${ID(1)}::uuid, 1), (${ID(2)}::uuid, 2), (${ID(3)}::uuid, 3), (${ID(4)}::uuid, 4))
        AS t(id, n)
      WHERE product.id = t.id`);
    for (const sortBy of [
      { field: "CREATED_AT", direction: "ASC" },
      { field: "CREATED_AT", direction: "DESC" },
      { field: "LAST_MODIFIED_AT", direction: "ASC" },
    ]) {
      const seen: string[] = [];
      let after: string | null = null;
      for (let pages = 0; pages < 20; pages++) {
        const page: Page = await products({ first: 1, after, sortBy });
        seen.push(...names(page));
        if (!page.pageInfo.hasNextPage) break;
        after = page.pageInfo.endCursor;
      }
      expect(seen).toEqual(await sort(sortBy.field, sortBy.direction as "ASC" | "DESC"));
      expect(new Set(seen).size).toBe(9);
    }
    // The four rows keep their microsecond order.
    const created = await sort("CREATED_AT", "ASC");
    expect(created.filter((n) => [1, 2, 3, 4].map(name).includes(n))).toEqual(
      [1, 2, 3, 4].map(name),
    );
  });
});

const PRODUCT_QUERY = `query ($id: ID, $slug: String) {
  product(id: $id, slug: $slug) {
    id name slug description
    category { id name slug }
    created updatedAt isPublished publishedAt
    minimalVariantPrice { amount currency }
    defaultVariant {
      id name sku trackInventory price { amount currency }
      product { id name }
    }
    variants { id name sku price { amount currency } }
  }
}`;

type VariantData = {
  id: string;
  name: string;
  sku: string | null;
  trackInventory: boolean;
  price: MoneyData;
  product: { id: string; name: string };
};

type ProductData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: { id: string; name: string; slug: string } | null;
  created: string;
  updatedAt: string;
  isPublished: boolean;
  publishedAt: string | null;
  minimalVariantPrice: MoneyData | null;
  defaultVariant: VariantData | null;
  variants: VariantData[];
};

async function product(variables: object, token?: string): Promise<ProductData | null> {
  const result = await client.gql(PRODUCT_QUERY, variables, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { product: ProductData | null }).product;
}

describe("product", () => {
  it("looks a public product up by id or slug with its category and variant shapes", async () => {
    const byId = await product({ id: toGlobalId("Product", ID(1)) });
    expect(byId).toMatchObject({
      id: toGlobalId("Product", ID(1)),
      name: "Prod 01",
      slug: "prod-01",
      description: null,
      category: { id: toGlobalId("Category", CATEGORY_ID), name: "Boots", slug: "boots" },
      isPublished: true,
      publishedAt: null,
      minimalVariantPrice: { amount: 3000, currency: "MNT" },
      defaultVariant: {
        name: "Small",
        sku: "SKU-A",
        trackInventory: true,
        price: { amount: 3000, currency: "MNT" },
        product: { id: toGlobalId("Product", ID(1)), name: "Prod 01" },
      },
    });
    expect(byId?.created).toBe(new Date(Date.UTC(2024, 0, 1)).toISOString());
    expect(byId?.updatedAt).toBe(new Date(Date.UTC(2024, 5, 13)).toISOString());
    expect(byId?.variants.map((variant) => variant.sku)).toEqual(["SKU-A", "SKU-B"]);
    expect(byId?.variants[1]?.price).toEqual({ amount: 5000, currency: "MNT" });

    const bySlug = await product({ slug: "prod-01" });
    expect(bySlug?.id).toBe(toGlobalId("Product", ID(1)));
  });

  it("returns a JSONString description and empty variant fields", async () => {
    const described = await product({ slug: "prod-07" });
    expect(JSON.parse(described?.description ?? "")).toEqual({
      blocks: [{ data: { text: "winter boots" } }],
    });

    const empty = await product({ slug: "prod-05" });
    expect(empty).toMatchObject({
      minimalVariantPrice: null,
      defaultVariant: null,
      variants: [],
    });
  });

  it("returns null for unpublished, future-dated and unknown products", async () => {
    expect(await product({ id: toGlobalId("Product", ID(10)) })).toBeNull();
    expect(await product({ slug: "prod-11" })).toBeNull();
    expect(await product({ slug: "nope" })).toBeNull();

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect((await product({ id: toGlobalId("Product", ID(10)) }, admin.token))?.name).toBe(
      "Prod 10",
    );
    expect((await product({ slug: "prod-11" }, admin.token))?.name).toBe("Prod 11");
  });

  it("requires exactly one of id and slug and uses Saleor's ID errors", async () => {
    const neither = await client.gql(PRODUCT_QUERY);
    expect(errorOf(neither)).toBe("At least one of arguments is required: 'id', 'slug'.");

    const both = await client.gql(PRODUCT_QUERY, {
      id: toGlobalId("Product", ID(1)),
      slug: "prod-01",
    });
    expect(errorOf(both)).toBe("Argument 'id' cannot be combined with 'slug'");

    const malformed = await client.gql(PRODUCT_QUERY, { id: "nope" });
    expect(errorOf(malformed)).toBe("Couldn't resolve id: nope.");

    const wrongType = toGlobalId("User", ID(1));
    const result = await client.gql(PRODUCT_QUERY, { id: wrongType });
    expect(errorOf(result)).toBe(`Invalid ID: ${wrongType}. Expected: Product, received: User.`);
  });
});
