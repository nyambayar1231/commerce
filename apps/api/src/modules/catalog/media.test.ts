import { closeDb, createDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createCatalogLoaders, getProductMedia } from "./index.ts";

// Product media reads (ADR-0014): the rows are images in S3, and `Product.media` resolves them
// through a per-request loader. Uploads arrive with M2.5.2.

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
const PRODUCT = ID(300);
const OTHER = ID(301);
const MISSING = ID(399);
const FIRST = ID(311);
const SECOND = ID(312);
const LAST = ID(310);
const SOLO = ID(320);

const imageKey = (mediaId: string, ext: string) => `products/${PRODUCT}/${mediaId}.${ext}`;

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await db.insert(schema.product).values([
    { id: PRODUCT, name: "Hoodie", slug: "hoodie", isPublished: true },
    { id: OTHER, name: "Cap", slug: "cap", isPublished: true },
  ]);
  await db.insert(schema.productMedia).values([
    // Two rows share sort_order 5: the id breaks the tie, so the order is total.
    {
      id: SECOND,
      productId: PRODUCT,
      imageKey: imageKey(SECOND, "jpg"),
      contentType: "image/jpeg",
      alt: "Second",
      sortOrder: 5,
    },
    {
      id: LAST,
      productId: PRODUCT,
      imageKey: imageKey(LAST, "jpg"),
      contentType: "image/jpeg",
      alt: "Last",
      sortOrder: 10,
    },
    {
      id: FIRST,
      productId: PRODUCT,
      imageKey: imageKey(FIRST, "jpg"),
      contentType: "image/jpeg",
      alt: "First",
      sortOrder: 5,
    },
    {
      id: SOLO,
      productId: OTHER,
      imageKey: imageKey(SOLO, "png"),
      contentType: "image/png",
      alt: "Solo",
      sortOrder: 0,
    },
  ]);
});

afterAll(async () => {
  await countingDb.$client.end({ timeout: 5 });
  await closeDb();
});

describe("getProductMedia", () => {
  it("returns a product's media ordered by sort_order, then id", async () => {
    const media = await getProductMedia(db, PRODUCT);

    expect(media.map((row) => row.alt)).toEqual(["First", "Second", "Last"]);
    expect(media.map((row) => row.id)).toEqual([FIRST, SECOND, LAST]);
  });

  it("returns [] for a product without media", async () => {
    expect(await getProductMedia(db, MISSING)).toEqual([]);
  });
});

describe("Product.media", () => {
  it("resolves Saleor's fields, with the original image's public URL", async () => {
    const result = await client.gql(
      `query Media($id: ID!) {
        product(id: $id) {
          media { id sortOrder alt type oembedData url productId }
        }
      }`,
      { id: toGlobalId("Product", PRODUCT) },
    );
    expect(result.body.errors).toBeUndefined();

    const media = (
      result.body.data as {
        product: {
          media: {
            id: string;
            sortOrder: number;
            alt: string;
            type: string;
            oembedData: string;
            url: string;
            productId: string;
          }[];
        };
      }
    ).product.media;

    const publicUrl = process.env.MEDIA_PUBLIC_URL;
    expect(media).toEqual([
      {
        id: toGlobalId("ProductMedia", FIRST),
        sortOrder: 5,
        alt: "First",
        type: "IMAGE",
        // JSONString keeps Saleor's "a document inside a string" shape; images have no oEmbed data.
        oembedData: "{}",
        url: `${publicUrl}/${imageKey(FIRST, "jpg")}`,
        productId: toGlobalId("Product", PRODUCT),
      },
      expect.objectContaining({ id: toGlobalId("ProductMedia", SECOND), alt: "Second" }),
      expect.objectContaining({ id: toGlobalId("ProductMedia", LAST), alt: "Last" }),
    ]);
  });

  it("is empty for a product without media", async () => {
    await db.insert(schema.product).values({
      id: MISSING,
      name: "Bare",
      slug: "bare",
      isPublished: true,
    });

    const result = await client.gql(
      `{ product(id: "${toGlobalId("Product", MISSING)}") { media { id } } }`,
    );

    expect(result.body.errors).toBeUndefined();
    expect((result.body.data as { product: { media: unknown[] } }).product.media).toEqual([]);
  });
});

describe("mediaByProductId loader", () => {
  it("batches several products into one query", async () => {
    const loaders = createCatalogLoaders(countingDb);
    counted.length = 0;

    const [first, other, missing] = await Promise.all([
      loaders.mediaByProductId.load(PRODUCT),
      loaders.mediaByProductId.load(OTHER),
      loaders.mediaByProductId.load(MISSING),
    ]);

    expect(first.map((row) => row.alt)).toEqual(["First", "Second", "Last"]);
    expect(other.map((row) => row.alt)).toEqual(["Solo"]);
    expect(missing).toEqual([]);
    expect(domainQueries()).toHaveLength(1);
  });
});
