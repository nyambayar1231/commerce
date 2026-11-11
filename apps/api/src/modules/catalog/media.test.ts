import { closeDb, createDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { getStorage, type Storage, StorageObjectNotFoundError } from "../../storage/index.ts";
import {
  createCatalogLoaders,
  createProductMedia,
  deleteProductMedia,
  getProductMedia,
  type ProductMediaRow,
  ProductNotFoundError,
} from "./index.ts";

// Product media reads and writes (ADR-0014): the rows are images in S3, `Product.media` resolves
// them through a per-request loader, and the write path keeps the row and the objects in step.

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
  delete process.env.PUBLIC_URL;
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

describe("Product.mediaById", () => {
  const MEDIA_BY_ID = `query MediaById($product: ID!, $media: ID!) {
    product(id: $product) { mediaById(id: $media) { id alt } }
  }`;

  it("resolves one of the product's own media", async () => {
    const result = await client.gql(MEDIA_BY_ID, {
      product: toGlobalId("Product", PRODUCT),
      media: toGlobalId("ProductMedia", SECOND),
    });

    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({
      product: {
        mediaById: { id: toGlobalId("ProductMedia", SECOND), alt: "Second" },
      },
    });
  });

  it("is null for another product's media", async () => {
    const result = await client.gql(MEDIA_BY_ID, {
      product: toGlobalId("Product", PRODUCT),
      media: toGlobalId("ProductMedia", SOLO),
    });

    expect(result.body.errors).toBeUndefined();
    expect((result.body.data as { product: { mediaById: unknown } }).product.mediaById).toBeNull();
  });

  it("rejects a malformed id or one of another type with Saleor's top-level error", async () => {
    const malformed = await client.gql(MEDIA_BY_ID, {
      product: toGlobalId("Product", PRODUCT),
      media: "not-a-global-id",
    });

    expect(malformed.body.errors?.[0]?.message).toBe("Couldn't resolve id: not-a-global-id.");

    const wrongType = await client.gql(MEDIA_BY_ID, {
      product: toGlobalId("Product", PRODUCT),
      media: toGlobalId("Product", OTHER),
    });

    expect(wrongType.body.errors?.[0]?.message).toBe(
      `Invalid ID: ${toGlobalId("Product", OTHER)}. Expected: ProductMedia, received: Product.`,
    );
  });
});

describe("ProductMedia.url", () => {
  const ORIGIN = "http://test";
  const proxyUrl = (mediaId: string, size: number, format = "") =>
    `${ORIGIN}/thumbnail/${toGlobalId("ProductMedia", mediaId)}/${size}/${format}`;

  const urlOfFirst = async (args = "") => {
    const result = await client.gql(
      `query ($id: ID!) { product(id: $id) { media { url${args} } } }`,
      { id: toGlobalId("Product", PRODUCT) },
    );
    expect(result.body.errors).toBeUndefined();
    const media = (result.body.data as { product: { media: { url: string }[] } }).product.media;
    const url = media[0]?.url;
    if (url === undefined) throw new Error("expected the first media");
    return url;
  };

  it("returns the original image's public URL without a size or with size 0", async () => {
    const original = `${process.env.MEDIA_PUBLIC_URL}/${imageKey(FIRST, "jpg")}`;
    expect(await urlOfFirst()).toBe(original);

    const zero = await client.gql(
      `query ($id: ID!) { product(id: $id) { media { url(size: 0) } } }`,
      { id: toGlobalId("Product", PRODUCT) },
    );
    const media = (zero.body.data as { product: { media: { url: string }[] } }).product.media;
    expect(media[0]?.url).toBe(original);
  });

  it("returns the proxy URL at the request origin before the thumbnail is generated", async () => {
    expect(await urlOfFirst("(size: 256)")).toBe(proxyUrl(FIRST, 256));
  });

  it("rounds the requested size and adds the format segment", async () => {
    const result = await client.gql(
      `query ($id: ID!) {
        product(id: $id) { media { url(size: 300, format: WEBP) } }
      }`,
      { id: toGlobalId("Product", PRODUCT) },
    );
    const media = (result.body.data as { product: { media: { url: string }[] } }).product.media;
    expect(media[0]?.url).toBe(proxyUrl(FIRST, 256, "webp/"));
  });

  it("uses PUBLIC_URL (without a trailing slash) when it is set", async () => {
    const previous = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = "https://api.example.com/";
    try {
      expect(await urlOfFirst("(size: 256)")).toBe(
        `https://api.example.com/thumbnail/${toGlobalId("ProductMedia", FIRST)}/256/`,
      );
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previous;
    }
  });

  it("returns the stored thumbnail's public URL once it exists", async () => {
    const key = `thumbnails/${FIRST}/256.jpg`;
    await db.insert(schema.productMediaThumbnail).values({
      mediaId: FIRST,
      size: 256,
      format: "ORIGINAL",
      imageKey: key,
    });

    expect(await urlOfFirst("(size: 256)")).toBe(`${process.env.MEDIA_PUBLIC_URL}/${key}`);
  });
});

describe("Product.thumbnail", () => {
  it("is the first media's thumbnail at 256 by default", async () => {
    const result = await client.gql(
      `query ($id: ID!) { product(id: $id) { thumbnail { url alt } } }`,
      { id: toGlobalId("Product", PRODUCT) },
    );

    expect(result.body.errors).toBeUndefined();
    expect(
      (result.body.data as { product: { thumbnail: { url: string; alt: string } } }).product
        .thumbnail,
    ).toEqual({
      url: `http://test/thumbnail/${toGlobalId("ProductMedia", FIRST)}/256/`,
      alt: "First",
    });
  });

  it("rounds with sizeRounding and takes a format", async () => {
    const result = await client.gql(
      `query ($id: ID!) {
        product(id: $id) { thumbnail(size: 300, sizeRounding: UP, format: WEBP) { url alt } }
      }`,
      { id: toGlobalId("Product", PRODUCT) },
    );

    expect(
      (result.body.data as { product: { thumbnail: { url: string; alt: string } } }).product
        .thumbnail,
    ).toEqual({
      url: `http://test/thumbnail/${toGlobalId("ProductMedia", FIRST)}/512/webp/`,
      alt: "First",
    });
  });

  it("is null for a product without media", async () => {
    await db.insert(schema.product).values({
      id: ID(350),
      name: "Bare",
      slug: "bare-thumbnail",
      isPublished: true,
    });

    const result = await client.gql(
      `{ product(id: "${toGlobalId("Product", ID(350))}") { thumbnail { url } } }`,
    );

    expect(result.body.errors).toBeUndefined();
    expect((result.body.data as { product: { thumbnail: unknown } }).product.thumbnail).toBeNull();
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

// The media write path (M2.5.2a): the row and its objects are one unit, with the object put before
// the row and deleted after it (ADR-0014), also when the storage call fails.
describe("media mutations", () => {
  const storage = getStorage();
  const PRODUCT_WITH_IMAGES = ID(330);
  // Objects this test created; deleted after it, as the rows are truncated before the next one.
  const objects: string[] = [];

  const image = async () => {
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#ff0000" },
    })
      .jpeg()
      .toBuffer();
    return new File([bytes], "image.jpg", { type: "image/jpeg" });
  };

  async function mustCreate(): Promise<ProductMediaRow> {
    const result = await createProductMedia(db, storage, {
      productId: PRODUCT_WITH_IMAGES,
      file: await image(),
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    objects.push(result.media.imageKey);
    return result.media;
  }

  beforeEach(async () => {
    objects.length = 0;
    await db
      .insert(schema.product)
      .values({ id: PRODUCT_WITH_IMAGES, name: "Beanie", slug: "beanie" });
  });

  afterEach(async () => {
    for (const key of objects) await storage.deleteObject(key).catch(() => undefined);
  });

  it("puts the image and appends the row after the product's last sort order", async () => {
    const first = await mustCreate();
    const second = await mustCreate();

    expect(first).toMatchObject({
      productId: PRODUCT_WITH_IMAGES,
      imageKey: `products/${PRODUCT_WITH_IMAGES}/${first.id}.jpg`,
      contentType: "image/jpeg",
      alt: "",
      sortOrder: 0,
    });
    expect(second.sortOrder).toBe(1);
    expect((await storage.getObject(first.imageKey)).byteLength).toBeGreaterThan(0);
  });

  it("rejects an unknown product without writing an object", async () => {
    const puts: string[] = [];
    const recording: Storage = {
      ...storage,
      async putObject(key, body, contentType) {
        puts.push(key);
        await storage.putObject(key, body, contentType);
      },
    };

    await expect(
      createProductMedia(db, recording, { productId: MISSING, file: await image() }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(puts).toEqual([]);
  });

  it("removes the object when the row insert fails after the upload", async () => {
    const raceProduct = ID(340);
    await db.insert(schema.product).values({ id: raceProduct, name: "Race", slug: "race" });

    const written: string[] = [];
    const racing: Storage = {
      ...storage,
      async putObject(key, body, contentType) {
        await storage.putObject(key, body, contentType);
        written.push(key);
        // The product is deleted between our existence check and the transaction's lock.
        await db.delete(schema.product).where(eq(schema.product.id, raceProduct));
      },
    };

    await expect(
      createProductMedia(db, racing, { productId: raceProduct, file: await image() }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(written).toHaveLength(1);
    await expect(storage.getObject(written[0] ?? "")).rejects.toBeInstanceOf(
      StorageObjectNotFoundError,
    );
  });

  it("deletes the row, the media object and the thumbnail objects", async () => {
    const media = await mustCreate();
    const thumbnailKey = `thumbnails/${media.id}/128.jpg`;
    objects.push(thumbnailKey);
    const thumbnailBytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#00ff00" },
    })
      .jpeg()
      .toBuffer();
    await storage.putObject(thumbnailKey, thumbnailBytes, "image/jpeg");
    await db.insert(schema.productMediaThumbnail).values({
      mediaId: media.id,
      size: 128,
      format: "ORIGINAL",
      imageKey: thumbnailKey,
    });

    const deleted = await deleteProductMedia(db, storage, media.id);

    expect(deleted.media.id).toBe(media.id);
    expect(
      await db.select().from(schema.productMedia).where(eq(schema.productMedia.id, media.id)),
    ).toEqual([]);
    expect(await db.select().from(schema.productMediaThumbnail)).toEqual([]);
    await expect(storage.getObject(media.imageKey)).rejects.toBeInstanceOf(
      StorageObjectNotFoundError,
    );
    await expect(storage.getObject(thumbnailKey)).rejects.toBeInstanceOf(
      StorageObjectNotFoundError,
    );
  });

  it("still deletes the row when S3 fails to delete the object", async () => {
    const media = await mustCreate();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const failing: Storage = {
        ...storage,
        deleteObject: async () => {
          throw new Error("S3 is down");
        },
      };

      const deleted = await deleteProductMedia(db, failing, media.id);

      expect(deleted.media.id).toBe(media.id);
      expect(
        await db.select().from(schema.productMedia).where(eq(schema.productMedia.id, media.id)),
      ).toEqual([]);
      // The orphan object is still there: the failure only logged, it did not roll back the row.
      expect((await storage.getObject(media.imageKey)).byteLength).toBeGreaterThan(0);
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});
