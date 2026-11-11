import { closeDb, getDb, schema } from "@commerce/db";
import { asc, eq, ne } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, type GqlResult } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// GraphQL contract for `products(where: ProductWhereInput)` (Saleor's ProductWhereInput subset),
// through the real app and the real (test) database. Filtering happens in SQL; these tests only
// see the result.

const db = getDb();
const client = createTestClient(db);

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BOOTS = ID(101);
const WINTER = ID(102);
const SNEAKERS = ID(103);
const name = (n: number) => `Prod ${String(n).padStart(2, "0")}`;
const updatedAt = (n: number) => new Date(Date.UTC(2024, 5, n, 12));

// Categories: Boots > Winter, plus Sneakers. P01 is in Boots, P02 and P07 in Winter, P03 in
// Sneakers, P04/P05 have none. P06 is unpublished and P07 is published in the future, so the
// public never sees them; staff with MANAGE_PRODUCTS do.
interface Fixture {
  n: number;
  categoryId: string | null;
  published: boolean;
  publishedAt: string | null;
  prices: number[];
}

const PRODUCTS: Fixture[] = [
  { n: 1, categoryId: BOOTS, published: true, publishedAt: null, prices: [3000, 5000] },
  {
    n: 2,
    categoryId: WINTER,
    published: true,
    publishedAt: "2020-01-01T00:00:00.000Z",
    prices: [2000],
  },
  { n: 3, categoryId: SNEAKERS, published: true, publishedAt: null, prices: [1000] },
  { n: 4, categoryId: null, published: true, publishedAt: null, prices: [4000] },
  { n: 5, categoryId: null, published: true, publishedAt: null, prices: [] },
  { n: 6, categoryId: BOOTS, published: false, publishedAt: null, prices: [100] },
  {
    n: 7,
    categoryId: WINTER,
    published: true,
    publishedAt: "2999-01-01T00:00:00.000Z",
    prices: [200],
  },
];

async function seed(): Promise<void> {
  await db.insert(schema.category).values([
    { id: BOOTS, name: "Boots", slug: "boots" },
    { id: WINTER, name: "Winter", slug: "winter", parentId: BOOTS },
    { id: SNEAKERS, name: "Sneakers", slug: "sneakers" },
  ]);
  for (const product of PRODUCTS) {
    await db.insert(schema.product).values({
      id: ID(product.n),
      name: name(product.n),
      slug: `prod-${String(product.n).padStart(2, "0")}`,
      categoryId: product.categoryId,
      isPublished: product.published,
      publishedAt: product.publishedAt === null ? null : new Date(product.publishedAt),
      createdAt: new Date(Date.UTC(2024, 0, product.n)),
      updatedAt: updatedAt(product.n),
    });
    for (const [position, price] of product.prices.entries()) {
      await db.insert(schema.productVariant).values({
        productId: ID(product.n),
        name: `Variant ${position}`,
        sku: `SKU-${product.n}-${position}`,
        priceAmount: price,
        currency: "MNT",
        position,
        // P04's variant doesn't track inventory; the stock filter ignores `trackInventory`.
        trackInventory: product.n !== 4,
      });
    }
  }

  // Stock rows for `stockAvailability`: P01 is in stock (one variant of two), P02's only stock is
  // fully allocated, P04's variant is untracked but in stock, P07 is in stock but staff-only.
  const [warehouse] = await db
    .select()
    .from(schema.warehouse)
    .where(eq(schema.warehouse.slug, "default-warehouse"));
  if (!warehouse) throw new Error("the migration did not seed a warehouse");
  const variantId = async (product: number): Promise<string> => {
    const [row] = await db
      .select({ id: schema.productVariant.id })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, ID(product)))
      .orderBy(asc(schema.productVariant.position))
      .limit(1);
    if (!row) throw new Error(`product ${product} has no variant`);
    return row.id;
  };
  for (const [product, quantity, quantityAllocated] of [
    [1, 5, 0],
    [2, 3, 3],
    [4, 2, 0],
    [7, 1, 0],
  ] as const) {
    await db.insert(schema.stock).values({
      warehouseId: warehouse.id,
      variantId: await variantId(product),
      quantity,
      quantityAllocated,
    });
  }
}

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await db.delete(schema.warehouse).where(ne(schema.warehouse.slug, "default-warehouse"));
  await seed();
});

afterAll(async () => {
  await closeDb();
});

const PRODUCTS_QUERY = `query ($where: ProductWhereInput, $search: String, $sortBy: ProductOrder, $first: Int, $last: Int, $after: String, $before: String) {
  products(where: $where, search: $search, sortBy: $sortBy, first: $first, last: $last, after: $after, before: $before) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges { cursor node { id name slug isPublished updatedAt } }
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
  edges: {
    cursor: string;
    node: { id: string; name: string; slug: string; isPublished: boolean };
  }[];
};

async function products(variables: object, token?: string): Promise<Page> {
  const result = await client.gql(PRODUCTS_QUERY, { first: 100, ...variables }, token);
  expect(result.body.errors).toBeUndefined();
  return (result.body.data as { products: Page }).products;
}

const names = async (where: object, token?: string) =>
  (await products({ where }, token)).edges.map((edge) => edge.node.name);

const namesOf = (numbers: number[]) => numbers.map(name);

/** The single error message of a rejected request. */
async function errorOf(where: object, token?: string): Promise<string | undefined> {
  const result: GqlResult = await client.gql(PRODUCTS_QUERY, { first: 100, where }, token);
  return result.body.errors?.[0]?.message;
}

describe("products(where: ProductWhereInput)", () => {
  it("filters by ids, with an empty or unknown list matching nothing", async () => {
    expect(
      await names({ ids: [toGlobalId("Product", ID(1)), toGlobalId("Product", ID(2))] }),
    ).toEqual(namesOf([1, 2]));
    expect(await names({ ids: [] })).toEqual([]);
    expect(await names({ ids: [toGlobalId("Product", ID(999))] })).toEqual([]);
  });

  it("filters by name and slug with eq and oneOf, an empty oneOf matching nothing", async () => {
    expect(await names({ name: { eq: name(1) } })).toEqual(namesOf([1]));
    expect(await names({ name: { eq: "prod 01" } })).toEqual([]);
    expect(await names({ name: { oneOf: [name(1), name(3)] } })).toEqual(namesOf([1, 3]));
    expect(await names({ name: { oneOf: [] } })).toEqual([]);
    expect(await names({ slug: { eq: "prod-02" } })).toEqual(namesOf([2]));
    expect(await names({ slug: { oneOf: ["prod-04", "prod-05"] } })).toEqual(namesOf([4, 5]));
    // An object with no operator is Saleor's `qs.none()`.
    expect(await names({ name: {} })).toEqual([]);
  });

  it("filters by category and its subcategories", async () => {
    expect(await names({ category: { eq: toGlobalId("Category", BOOTS) } })).toEqual(
      namesOf([1, 2]),
    );
    expect(
      await names({
        category: { oneOf: [toGlobalId("Category", WINTER), toGlobalId("Category", SNEAKERS)] },
      }),
    ).toEqual(namesOf([2, 3]));
    expect(await names({ category: { oneOf: [] } })).toEqual([]);
    expect(await names({ category: { eq: toGlobalId("Category", ID(999)) } })).toEqual([]);

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(await names({ category: { eq: toGlobalId("Category", BOOTS) } }, admin.token)).toEqual(
      namesOf([1, 2, 6, 7]),
    );
  });

  it("filters by hasCategory", async () => {
    expect(await names({ hasCategory: false })).toEqual(namesOf([4, 5]));
    expect(await names({ hasCategory: true })).toEqual(namesOf([1, 2, 3]));
  });

  it("keeps the visibility rule on top of isPublished", async () => {
    expect(await names({ isPublished: false })).toEqual([]);
    expect(await names({ isPublished: true })).toEqual(namesOf([1, 2, 3, 4, 5]));

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(await names({ isPublished: false }, admin.token)).toEqual(namesOf([6]));
    expect(await names({ isPublished: true }, admin.token)).toEqual(namesOf([1, 2, 3, 4, 5, 7]));
  });

  it("filters by any variant price and by the minimal price", async () => {
    // P01 has variants at 3000 and 5000: any variant matches `price`, only the lowest `minimalPrice`.
    expect(await names({ price: { eq: 5000 } })).toEqual(namesOf([1]));
    expect(await names({ minimalPrice: { eq: 5000 } })).toEqual([]);
    expect(await names({ minimalPrice: { eq: 3000 } })).toEqual(namesOf([1]));

    expect(await names({ price: { oneOf: [1000, 5000] } })).toEqual(namesOf([1, 3]));
    expect(await names({ price: { oneOf: [] } })).toEqual([]);
    // A decimal may arrive as a numeric string; prices are compared in minor units.
    expect(await names({ price: { eq: "3000" } })).toEqual(namesOf([1]));

    // Products without variants never match a price filter.
    expect(await names({ price: { range: { lte: 100000 } } })).toEqual(namesOf([1, 2, 3, 4]));
    expect(await names({ minimalPrice: { range: { lte: 100000 } } })).toEqual(
      namesOf([1, 2, 3, 4]),
    );
  });

  it("supports open and closed price ranges", async () => {
    expect(await names({ price: { range: { gte: 4000 } } })).toEqual(namesOf([1, 4]));
    expect(await names({ price: { range: { lte: 1000 } } })).toEqual(namesOf([3]));
    expect(await names({ price: { range: { gte: 2000, lte: 3000 } } })).toEqual(namesOf([1, 2]));
    expect(await names({ minimalPrice: { range: { lte: 2000 } } })).toEqual(namesOf([2, 3]));
    // An empty range (like an empty filter) matches nothing, as Saleor.
    expect(await names({ price: { range: {} } })).toEqual([]);
  });

  it("filters by stockAvailability, ignoring trackInventory", async () => {
    // P01 is in stock through one of its two variants, P04 through an untracked variant, P02's
    // only stock is fully allocated, and P03/P05 have no stock (P05 no variants at all).
    expect(await names({ stockAvailability: "IN_STOCK" })).toEqual(namesOf([1, 4]));
    expect(await names({ stockAvailability: "OUT_OF_STOCK" })).toEqual(namesOf([2, 3, 5]));

    // P07 is published in the future, so only staff see it.
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(await names({ stockAvailability: "IN_STOCK" }, admin.token)).toEqual(namesOf([1, 4, 7]));
    expect(await names({ stockAvailability: "OUT_OF_STOCK" }, admin.token)).toEqual(
      namesOf([2, 3, 5, 6]),
    );
  });

  it("combines stockAvailability with AND and OR", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(
      await names(
        { AND: [{ stockAvailability: "IN_STOCK" }, { name: { eq: name(1) } }] },
        admin.token,
      ),
    ).toEqual(namesOf([1]));
    expect(
      await names(
        { OR: [{ stockAvailability: "IN_STOCK" }, { slug: { eq: "prod-03" } }] },
        admin.token,
      ),
    ).toEqual(namesOf([1, 3, 4, 7]));
  });

  it("filters by updatedAt with eq, oneOf and range", async () => {
    expect(await names({ updatedAt: { eq: updatedAt(3).toISOString() } })).toEqual(namesOf([3]));
    expect(
      await names({
        updatedAt: { oneOf: [updatedAt(1).toISOString(), updatedAt(2).toISOString()] },
      }),
    ).toEqual(namesOf([1, 2]));
    expect(await names({ updatedAt: { range: { lte: updatedAt(2).toISOString() } } })).toEqual(
      namesOf([1, 2]),
    );

    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    expect(
      await names({ updatedAt: { range: { gte: updatedAt(5).toISOString() } } }, admin.token),
    ).toEqual(namesOf([5, 6, 7]));
    expect(await names({ updatedAt: { range: {} } })).toEqual([]);
  });

  it("combines objects with AND and OR, including nesting", async () => {
    expect(await names({ AND: [{ name: { eq: name(1) } }, { price: { eq: 3000 } }] })).toEqual(
      namesOf([1]),
    );
    expect(await names({ OR: [{ name: { eq: name(1) } }, { slug: { eq: "prod-03" } }] })).toEqual(
      namesOf([1, 3]),
    );
    expect(
      await names({
        AND: [
          { OR: [{ name: { eq: name(1) } }, { name: { eq: name(2) } }] },
          { price: { range: { gte: 2500 } } },
        ],
      }),
    ).toEqual(namesOf([1]));
    expect(
      await names({
        OR: [
          { AND: [{ name: { eq: name(1) } }, { price: { eq: 5000 } }] },
          { slug: { eq: "prod-03" } },
        ],
      }),
    ).toEqual(namesOf([1, 3]));
  });

  it("treats an empty object and empty operators as no filter", async () => {
    expect(await names({})).toEqual(namesOf([1, 2, 3, 4, 5]));
    expect(await names({ AND: [] })).toEqual(namesOf([1, 2, 3, 4, 5]));
    expect(await names({ OR: [] })).toEqual(namesOf([1, 2, 3, 4, 5]));
  });

  it("refuses mixing operators with other filter inputs", async () => {
    expect(await errorOf({ name: { eq: name(1) }, AND: [{ slug: { eq: "prod-01" } }] })).toBe(
      "Cannot mix operators with other filter inputs.",
    );
    expect(
      await errorOf({
        AND: [{ name: { eq: name(1) } }],
        OR: [{ name: { eq: name(2) } }],
      }),
    ).toBe("Cannot mix operators with other filter inputs.");
  });

  it("refuses invalid decimals", async () => {
    // MNT has no minor unit below one tögrög (ADR-0013); parseDecimal never rounds.
    expect(await errorOf({ price: { eq: "15000.50" } })).toBe(
      'MNT allows at most 0 decimal places: "15000.50"',
    );
    // A non-numeric string is rejected by the scalar while GraphQL coerces the variables.
    expect(await errorOf({ minimalPrice: { range: { gte: "abc" } } })).toBe(
      'Variable "$where" has invalid value at .minimalPrice.range.gte: Decimal must be a number or a numeric string.',
    );
  });

  it("refuses wrong-type and malformed global IDs", async () => {
    const asProduct = toGlobalId("Product", ID(1));
    expect(await errorOf({ category: { eq: asProduct } })).toBe(
      `Invalid ID: ${asProduct}. Expected: Category, received: Product.`,
    );
    const asCategory = toGlobalId("Category", BOOTS);
    expect(await errorOf({ ids: [asCategory] })).toBe(
      `Invalid ID: ${asCategory}. Expected: Product, received: Category.`,
    );
    expect(await errorOf({ ids: ["nope"] })).toBe("Couldn't resolve id: nope.");
  });

  it("refuses where nested deeper than five levels", async () => {
    const nested = (levels: number) => {
      let where: object = { name: { eq: name(1) } };
      for (let level = 0; level < levels; level += 1) where = { AND: [where] };
      return where;
    };
    expect(await names(nested(4))).toEqual(namesOf([1]));
    expect(await errorOf(nested(5))).toBe(
      "The `where` argument is nested too deeply (maximum 5 levels).",
    );
  });

  it("combines where with search, sort, paging and totalCount", async () => {
    const where = { name: { oneOf: namesOf([1, 2, 3, 4, 5]) } };
    const sortBy = { field: "PRICE", direction: "ASC" };
    const first = await products({ where, search: "prod", sortBy, first: 2 });
    expect(first.totalCount).toBe(5);
    expect(first.edges.map((edge) => edge.node.name)).toEqual(namesOf([5, 3]));
    expect(first.pageInfo.hasNextPage).toBe(true);

    const rest = await products({
      where,
      search: "prod",
      sortBy,
      first: 2,
      after: first.pageInfo.endCursor,
    });
    expect(rest.totalCount).toBe(5);
    expect(rest.edges.map((edge) => edge.node.name)).toEqual(namesOf([2, 1]));
    expect(rest.pageInfo.hasNextPage).toBe(true);

    const result = await client.gql(
      `query ($where: ProductWhereInput) { products(where: $where) { totalCount } }`,
      { where: { name: { eq: name(1) } } },
    );
    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({ products: { totalCount: 1 } });
  });
});
