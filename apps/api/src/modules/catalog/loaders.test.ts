import { closeDb, createDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient } from "../../../test/graphql.ts";
import { createCatalogLoaders } from "./index.ts";

// Nested catalog fields resolve through per-request DataLoaders (ARCHITECTURE.md §5.1 step 5).
// The acceptance test counts the SQL statements postgres.js sends through the real app: a page
// of products must cost a constant number of queries, not one per row.

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
const ROOT = ID(200);
const BOOTS = ID(201);
const SHOES = ID(202);
const HATS = ID(203);

// Three categories under one parent, so `category { parent { name } }` needs a second batch too.
const CATEGORIES = [
  { id: ROOT, name: "Root", slug: "root", parentId: null },
  { id: BOOTS, name: "Boots", slug: "boots", parentId: ROOT },
  { id: SHOES, name: "Shoes", slug: "shoes", parentId: ROOT },
  { id: HATS, name: "Hats", slug: "hats", parentId: null },
];

const PRODUCT_CATEGORIES = [BOOTS, SHOES, HATS];

/** A published product with two variants; `n` also seeds its slug, sku and price. */
async function seedProduct(n: number): Promise<void> {
  await db.insert(schema.product).values({
    id: ID(n),
    categoryId: PRODUCT_CATEGORIES[(n - 1) % PRODUCT_CATEGORIES.length],
    name: `Prod ${String(n).padStart(2, "0")}`,
    slug: `prod-${String(n).padStart(2, "0")}`,
    isPublished: true,
  });
  await db.insert(schema.productVariant).values([
    {
      productId: ID(n),
      name: "Small",
      sku: `SKU-${n}-A`,
      priceAmount: 1000 + n,
      currency: "MNT",
      position: 1,
    },
    {
      productId: ID(n),
      name: "Large",
      sku: `SKU-${n}-B`,
      priceAmount: 2000 + n,
      currency: "MNT",
      position: 0,
    },
  ]);
}

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await db.insert(schema.category).values(CATEGORIES);
  for (let n = 1; n <= 10; n += 1) await seedProduct(n);
});

afterAll(async () => {
  await countingDb.$client.end({ timeout: 5 });
  await closeDb();
});

const PRODUCTS_WITH_NESTED_FIELDS = `query {
  products(first: 20) {
    edges {
      node {
        id
        category { name parent { name } }
        variants { sku price { amount } product { name } }
        defaultVariant { sku }
        minimalVariantPrice { amount }
      }
    }
  }
}`;

type Node = {
  id: string;
  category: { name: string; parent: { name: string } | null } | null;
  variants: { sku: string | null; price: { amount: number }; product: { name: string } }[];
  defaultVariant: { sku: string | null } | null;
  minimalVariantPrice: { amount: number } | null;
};

async function queryPage(): Promise<{ nodes: Node[]; queries: number }> {
  counted.length = 0;
  const result = await client.gql(PRODUCTS_WITH_NESTED_FIELDS);
  expect(result.body.errors).toBeUndefined();
  const products = (result.body.data as { products: { edges: { node: Node }[] } }).products;
  return { nodes: products.edges.map((edge) => edge.node), queries: domainQueries().length };
}

describe("products with nested fields", () => {
  it("resolves nested fields in a constant number of queries", async () => {
    const before = await queryPage();

    // Sanity: every nested field still resolves through the loaders.
    expect(before.nodes).toHaveLength(10);
    expect(before.nodes[0]).toMatchObject({
      category: { name: "Boots", parent: { name: "Root" } },
      // Variants stay ordered by position, then id.
      variants: [
        { sku: "SKU-1-B", price: { amount: 2001 }, product: { name: "Prod 01" } },
        { sku: "SKU-1-A", price: { amount: 1001 }, product: { name: "Prod 01" } },
      ],
      defaultVariant: { sku: "SKU-1-B" },
      minimalVariantPrice: { amount: 1001 },
    });
    expect(before.nodes[2]?.category).toEqual({ name: "Hats", parent: null });

    // 2 (list rows + count) + 1 (categories) + 1 (parents) + 1 (variants) + 1 (variant products).
    expect(before.queries).toBe(6);

    // Ten more products must not add queries: the loaders batch across the whole page.
    for (let n = 11; n <= 20; n += 1) await seedProduct(n);
    const after = await queryPage();
    expect(after.nodes).toHaveLength(20);
    expect(after.queries).toBe(before.queries);
  });
});

describe("createCatalogLoaders", () => {
  it("answers in key order and returns null for missing category ids", async () => {
    const loaders = createCatalogLoaders(countingDb);
    counted.length = 0;
    const ids = [HATS, "00000000-0000-4000-8000-000000009999", BOOTS];
    const [hats, missing, boots] = await Promise.all(
      ids.map((id) => loaders.categoryById.load(id)),
    );

    expect(hats?.name).toBe("Hats");
    expect(missing).toBeNull();
    expect(boots?.name).toBe("Boots");
    expect(domainQueries()).toHaveLength(1);
  });

  it("returns [] for a product without variants and keeps variants ordered by position", async () => {
    const loaders = createCatalogLoaders(countingDb);
    counted.length = 0;
    const [variants, none] = await Promise.all([
      loaders.variantsByProductId.load(ID(1)),
      loaders.variantsByProductId.load("00000000-0000-4000-8000-000000009999"),
    ]);

    expect(variants.map((variant) => variant.sku)).toEqual(["SKU-1-B", "SKU-1-A"]);
    expect(none).toEqual([]);
    expect(domainQueries()).toHaveLength(1);
  });

  it("batches thumbnails by media id, size and format into one query", async () => {
    const firstMedia = ID(101);
    const secondMedia = ID(102);
    await db.insert(schema.productMedia).values([
      {
        id: firstMedia,
        productId: ID(1),
        imageKey: `products/${ID(1)}/${firstMedia}.jpg`,
        contentType: "image/jpeg",
      },
      {
        id: secondMedia,
        productId: ID(2),
        imageKey: `products/${ID(2)}/${secondMedia}.jpg`,
        contentType: "image/jpeg",
      },
    ]);
    await db.insert(schema.productMediaThumbnail).values([
      {
        mediaId: firstMedia,
        size: 256,
        format: "ORIGINAL",
        imageKey: `thumbnails/${firstMedia}/256.jpg`,
      },
      {
        mediaId: secondMedia,
        size: 256,
        format: "WEBP",
        imageKey: `thumbnails/${secondMedia}/256.webp`,
      },
    ]);

    const loaders = createCatalogLoaders(countingDb);
    counted.length = 0;
    const [first, second, missing] = await Promise.all([
      loaders.thumbnailByMediaIdSizeFormat.load({
        mediaId: firstMedia,
        size: 256,
        format: "ORIGINAL",
      }),
      loaders.thumbnailByMediaIdSizeFormat.load({
        mediaId: secondMedia,
        size: 256,
        format: "WEBP",
      }),
      loaders.thumbnailByMediaIdSizeFormat.load({
        mediaId: firstMedia,
        size: 512,
        format: "ORIGINAL",
      }),
    ]);

    expect(first?.imageKey).toBe(`thumbnails/${firstMedia}/256.jpg`);
    expect(second?.imageKey).toBe(`thumbnails/${secondMedia}/256.webp`);
    expect(missing).toBeNull();
    expect(domainQueries()).toHaveLength(1);
  });
});
