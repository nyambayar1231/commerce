import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientAt } from "../test/graphql.ts";
import { createApp } from "./app.ts";
import { toGlobalId } from "./graphql/globalId.ts";
import { createProductMedia, type ProductMediaRow } from "./modules/catalog/index.ts";
import { getStorage } from "./storage/index.ts";
import { GENERATIONS_PER_MINUTE } from "./thumbnailRoute.ts";

// Saleor's on-demand thumbnail endpoint through the real Yoga app, the commerce_test database and
// the test media bucket: anonymous GET/HEAD, redirects, generation, reuse and every error answer.

const db = getDb();
const app = createApp(db, { allowedOrigins: ["http://localhost:5173"] });
const storage = getStorage();

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PRODUCT = ID(500);
const MISSING = ID(599);

const productMediaId = (id: string) => toGlobalId("ProductMedia", id);

async function currentObjectKeys(): Promise<string[]> {
  const media = await db.select({ key: schema.productMedia.imageKey }).from(schema.productMedia);
  const thumbnails = await db
    .select({ key: schema.productMediaThumbnail.imageKey })
    .from(schema.productMediaThumbnail);
  return [...media, ...thumbnails].map((row) => row.key);
}

async function clearObjects(): Promise<void> {
  for (const key of await currentObjectKeys()) {
    await storage.deleteObject(key).catch(() => undefined);
  }
}

beforeEach(async () => {
  await clearObjects();
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, category, product, rate_limit CASCADE',
  );
  await db.insert(schema.product).values({ id: PRODUCT, name: "Hoodie", slug: "hoodie" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await clearObjects();
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await closeDb();
});

const get = (path: string, method = "GET", ip?: string) =>
  app.fetch(`http://test${path}`, { method }, clientAt(ip));

/** A JPEG of `width`x`height`, uploaded through the domain function (the real media path). */
async function uploadJpeg(width: number, height: number): Promise<ProductMediaRow> {
  const bytes = await sharp({
    create: { width, height, channels: 3, background: "#3366ff" },
  })
    .jpeg()
    .toBuffer();
  const result = await createProductMedia(db, storage, {
    productId: PRODUCT,
    alt: "Photo",
    file: new File([bytes], "photo.jpg", { type: "image/jpeg" }),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.media;
}

/** A media row whose object is exactly `bytes` (or missing when undefined). */
async function seedMedia(id: string, bytes?: Uint8Array, ext = "jpg"): Promise<string> {
  const key = `products/${PRODUCT}/${id}.${ext}`;
  if (bytes !== undefined) await storage.putObject(key, bytes, "image/jpeg");
  await db.insert(schema.productMedia).values({
    id,
    productId: PRODUCT,
    imageKey: key,
    contentType: "image/jpeg",
  });
  return key;
}

async function bodyText(response: Response): Promise<string> {
  return (await response.text()).trim();
}

describe("GET /thumbnail/:id/:size/", () => {
  it("generates a JPEG thumbnail, redirects to it and reuses the row", async () => {
    const media = await uploadJpeg(1000, 600);
    const url = `/thumbnail/${productMediaId(media.id)}/256/`;
    const key = `thumbnails/${media.id}/256.jpg`;
    const putObject = vi.spyOn(storage, "putObject");
    const getObject = vi.spyOn(storage, "getObject");

    const first = await get(url);
    expect(first.status).toBe(302);
    expect(first.headers.get("location")).toBe(storage.publicUrl(key));
    expect(putObject).toHaveBeenCalledTimes(1);

    const stored = await fetch(storage.publicUrl(key));
    expect(stored.status).toBe(200);
    expect(stored.headers.get("content-type")).toBe("image/jpeg");
    const metadata = await sharp(new Uint8Array(await stored.arrayBuffer())).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(256);

    const rows = await db
      .select()
      .from(schema.productMediaThumbnail)
      .where(eq(schema.productMediaThumbnail.mediaId, media.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ size: 256, format: "ORIGINAL", imageKey: key });

    const second = await get(url);
    expect(second.status).toBe(302);
    expect(second.headers.get("location")).toBe(storage.publicUrl(key));
    expect(putObject).toHaveBeenCalledTimes(1);
    // The stored row answers the redirect without reading S3 at all.
    expect(getObject).toHaveBeenCalledTimes(1);
    expect(await db.select().from(schema.productMediaThumbnail)).toHaveLength(1);
  });

  it("rounds the size and encodes WebP", async () => {
    const media = await uploadJpeg(1000, 600);
    const key = `thumbnails/${media.id}/256.webp`;

    const response = await get(`/thumbnail/${productMediaId(media.id)}/300/webp/`);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(storage.publicUrl(key));
    const stored = await fetch(storage.publicUrl(key));
    expect(stored.headers.get("content-type")).toBe("image/webp");
    const metadata = await sharp(new Uint8Array(await stored.arrayBuffer())).metadata();
    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(256);
  });

  it("does not enlarge an image smaller than the requested size", async () => {
    const media = await uploadJpeg(1000, 600);
    const key = `thumbnails/${media.id}/4096.jpg`;

    const response = await get(`/thumbnail/${productMediaId(media.id)}/4096/`);

    expect(response.status).toBe(302);
    const stored = await fetch(storage.publicUrl(key));
    const metadata = await sharp(new Uint8Array(await stored.arrayBuffer())).metadata();
    expect(metadata.width).toBe(1000);
    expect(metadata.height).toBe(600);
  });

  it("encodes AVIF", async () => {
    const media = await uploadJpeg(1000, 600);
    const key = `thumbnails/${media.id}/256.avif`;

    const response = await get(`/thumbnail/${productMediaId(media.id)}/256/avif/`);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(storage.publicUrl(key));
    const stored = await fetch(storage.publicUrl(key));
    expect(stored.headers.get("content-type")).toBe("image/avif");
    const metadata = await sharp(new Uint8Array(await stored.arrayBuffer())).metadata();
    // libvips reports AVIF as the HEIF container with an AV1 payload.
    expect(metadata.mediaType).toBe("image/avif");
  });

  it("answers HEAD with the same redirect and no body", async () => {
    const media = await uploadJpeg(100, 100);
    const key = `thumbnails/${media.id}/128.jpg`;

    const response = await get(`/thumbnail/${productMediaId(media.id)}/128/`, "HEAD");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(storage.publicUrl(key));
    expect(await response.text()).toBe("");
  });

  it("works without the GraphQL CSRF header (anonymous, like Saleor)", async () => {
    const media = await uploadJpeg(100, 100);

    const response = await app.fetch(`http://test/thumbnail/${productMediaId(media.id)}/128/`);

    expect(response.status).toBe(302);
  });
});

describe("GET /thumbnail/ errors", () => {
  it("404s a global ID that cannot be decoded", async () => {
    const response = await get("/thumbnail/not-a-global-id/256/");

    expect(response.status).toBe(404);
    expect(await bodyText(response)).toBe("Cannot found instance with the given id.");
  });

  it("404s a global ID of another type", async () => {
    const response = await get(`/thumbnail/${toGlobalId("Product", PRODUCT)}/256/`);

    expect(response.status).toBe(404);
    expect(await bodyText(response)).toBe("Invalid instance type.");
  });

  it("404s an unsupported format", async () => {
    const media = await uploadJpeg(100, 100);

    const response = await get(`/thumbnail/${productMediaId(media.id)}/256/gif/`);

    expect(response.status).toBe(404);
    expect(await bodyText(response)).toBe("Unsupported image format.");
  });

  it("404s a media that does not exist", async () => {
    const response = await get(`/thumbnail/${productMediaId(MISSING)}/256/`);

    expect(response.status).toBe(404);
    expect(await bodyText(response)).toBe("Instance with the given id cannot be found.");
  });

  it("404s when the original object is missing", async () => {
    await seedMedia(ID(501));

    const response = await get(`/thumbnail/${productMediaId(ID(501))}/256/`);

    expect(response.status).toBe(404);
    expect(await bodyText(response)).toBe("Cannot found image file.");
  });

  it("400s an image over sharp's pixel limit", async () => {
    await seedMedia(ID(502), await oversizedPng(), "png");

    const response = await get(`/thumbnail/${productMediaId(ID(502))}/256/`);

    expect(response.status).toBe(400);
    expect(await bodyText(response)).toBe("Image is too large.");
  });

  it("400s an undecodable image", async () => {
    await seedMedia(ID(503), new TextEncoder().encode("not an image at all"));

    const response = await get(`/thumbnail/${productMediaId(ID(503))}/256/`);

    expect(response.status).toBe(400);
    expect(await bodyText(response)).toBe("Invalid image.");
  });

  it("500s an unexpected storage error and logs its cause", async () => {
    const media = await uploadJpeg(100, 100);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(storage, "getObject").mockRejectedValue(new Error("S3 is down"));

    const response = await get(`/thumbnail/${productMediaId(media.id)}/256/`);

    expect(response.status).toBe(500);
    expect(await bodyText(response)).toBe("Internal server error.");
    expect(logged).toHaveBeenCalled();
  });
});

/** A PNG whose IHDR claims 20000x20000 pixels: above sharp's default limit, tiny on disk. */
async function oversizedPng(): Promise<Uint8Array> {
  const png = Buffer.from(
    await sharp({ create: { width: 1, height: 1, channels: 3, background: "#000000" } })
      .png()
      .toBuffer(),
  );
  png.writeUInt32BE(20_000, 16);
  png.writeUInt32BE(20_000, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  return new Uint8Array(png);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// PLAN M9.4: only generation is limited, per client IP, in a one-minute window.
describe("thumbnail generation limit", () => {
  const IP = "198.51.100.20";
  // The IP's window as if it had already generated the maximum, ending in 30 seconds.
  const exhaustWindow = (ip: string) =>
    db.insert(schema.rateLimit).values({
      key: `thumbnail:ip:${ip}`,
      count: GENERATIONS_PER_MINUTE,
      expiresAt: new Date(Date.now() + 30_000),
    });

  it("counts each generation for the client IP", async () => {
    const media = await uploadJpeg(400, 300);
    expect((await get(`/thumbnail/${productMediaId(media.id)}/64/`, "GET", IP)).status).toBe(302);
    // Served from the stored row: not counted.
    expect((await get(`/thumbnail/${productMediaId(media.id)}/64/`, "GET", IP)).status).toBe(302);
    const [row] = await db
      .select()
      .from(schema.rateLimit)
      .where(eq(schema.rateLimit.key, `thumbnail:ip:${IP}`));
    expect(row?.count).toBe(1);
  });

  it("answers 429 with Retry-After over the limit, but still redirects to existing ones", async () => {
    const media = await uploadJpeg(400, 300);
    expect((await get(`/thumbnail/${productMediaId(media.id)}/64/`)).status).toBe(302);
    await exhaustWindow(IP);
    const putObject = vi.spyOn(storage, "putObject");

    const limited = await get(`/thumbnail/${productMediaId(media.id)}/128/`, "GET", IP);
    expect(limited.status).toBe(429);
    expect(await bodyText(limited)).toBe("Too many thumbnail requests.");
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(29);
    expect(retryAfter).toBeLessThanOrEqual(31);
    expect(putObject).not.toHaveBeenCalled();

    expect((await get(`/thumbnail/${productMediaId(media.id)}/64/`, "GET", IP)).status).toBe(302);
    // Another client is not affected.
    const other = await get(`/thumbnail/${productMediaId(media.id)}/128/`, "GET", "198.51.100.21");
    expect(other.status).toBe(302);
  });
});
