import { afterAll, describe, expect, it } from "vitest";
import {
  createS3Storage,
  getStorage,
  productMediaKey,
  readStorageConfig,
  StorageObjectNotFoundError,
  thumbnailKey,
} from "./index.ts";

// The storage module against the real S3 server from docker-compose (ADR-0014): the test bucket
// was created by test/global-setup.ts, and `getStorage()` reads the same variables production
// reads (apps/api/vitest.config.ts points them at the test bucket).

const storage = getStorage();
const created: string[] = [];

/** A unique key under `tests/`, deleted after the file finishes. */
function testKey(): string {
  const key = `tests/${crypto.randomUUID()}.png`;
  created.push(key);
  return key;
}

const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

afterAll(async () => {
  for (const key of created) await storage.deleteObject(key);
});

describe("S3 storage", () => {
  it("serves a stored object anonymously at its public URL with its content type", async () => {
    const key = testKey();
    await storage.putObject(key, BYTES, "image/png");

    const response = await fetch(storage.publicUrl(key));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("returns the stored bytes from getObject", async () => {
    const key = testKey();
    await storage.putObject(key, BYTES, "image/png");

    expect(await storage.getObject(key)).toEqual(BYTES);
  });

  it("throws StorageObjectNotFoundError for a deleted or never stored key", async () => {
    const key = testKey();
    await storage.putObject(key, BYTES, "image/png");
    await storage.deleteObject(key);

    await expect(storage.getObject(key)).rejects.toBeInstanceOf(StorageObjectNotFoundError);
    // A missing key must never surface as a raw SDK error.
    await expect(storage.getObject(testKey())).rejects.toBeInstanceOf(StorageObjectNotFoundError);
  });

  it("treats deleting a missing key as success", async () => {
    await expect(storage.deleteObject(testKey())).resolves.toBeUndefined();
  });

  it("ensureBucket is idempotent", async () => {
    await expect(storage.ensureBucket()).resolves.toBeUndefined();
    await expect(storage.ensureBucket()).resolves.toBeUndefined();
  });
});

describe("readStorageConfig", () => {
  it("reads the variables and strips trailing slashes from the public URL", () => {
    expect(
      readStorageConfig({
        AWS_MEDIA_BUCKET_NAME: "commerce-media",
        MEDIA_PUBLIC_URL: "http://localhost:8333/commerce-media/",
        AWS_S3_ENDPOINT_URL: "http://localhost:8333",
        AWS_S3_REGION_NAME: "eu-central-1",
        AWS_ACCESS_KEY_ID: "key",
        AWS_SECRET_ACCESS_KEY: "secret",
      }),
    ).toEqual({
      bucket: "commerce-media",
      endpoint: "http://localhost:8333",
      region: "eu-central-1",
      accessKeyId: "key",
      secretAccessKey: "secret",
      publicUrl: "http://localhost:8333/commerce-media",
    });
  });

  it("defaults the region and lets the SDK find credentials when none are set", () => {
    const config = readStorageConfig({
      AWS_MEDIA_BUCKET_NAME: "commerce-media",
      MEDIA_PUBLIC_URL: "https://cdn.example.com/media",
    });

    expect(config.endpoint).toBeUndefined();
    expect(config.region).toBe("us-east-1");
    expect(config.accessKeyId).toBeUndefined();
    expect(config.secretAccessKey).toBeUndefined();
  });

  it("names the missing variable", () => {
    expect(() => readStorageConfig({ MEDIA_PUBLIC_URL: "http://cdn/b" })).toThrow(
      /AWS_MEDIA_BUCKET_NAME/,
    );
    expect(() => readStorageConfig({ AWS_MEDIA_BUCKET_NAME: "b" })).toThrow(/MEDIA_PUBLIC_URL/);
    // Half a credential pair fails with the missing half, not deep inside request signing.
    expect(() =>
      readStorageConfig({
        AWS_MEDIA_BUCKET_NAME: "b",
        MEDIA_PUBLIC_URL: "https://cdn/b",
        AWS_ACCESS_KEY_ID: "key",
      }),
    ).toThrow(/AWS_SECRET_ACCESS_KEY/);
  });
});

describe("storage keys", () => {
  it("builds product media keys", () => {
    expect(productMediaKey("product-uuid", "media-uuid", "jpg")).toBe(
      "products/product-uuid/media-uuid.jpg",
    );
  });

  it("builds thumbnail keys, keeping the source extension for ORIGINAL", () => {
    expect(thumbnailKey("media-uuid", 256, "WEBP")).toBe("thumbnails/media-uuid/256.webp");
    expect(thumbnailKey("media-uuid", 1024, "AVIF")).toBe("thumbnails/media-uuid/1024.avif");
    expect(thumbnailKey("media-uuid", 512, "ORIGINAL", "jpeg")).toBe(
      "thumbnails/media-uuid/512.jpeg",
    );
    expect(() => thumbnailKey("media-uuid", 512, "ORIGINAL")).toThrow(/sourceExt/);
  });

  it("URL-encodes each key segment in publicUrl", () => {
    const local = createS3Storage({
      bucket: "commerce-media",
      region: "us-east-1",
      publicUrl: "http://localhost:8333/commerce-media",
    });

    expect(local.publicUrl("products/p/m.png")).toBe(
      "http://localhost:8333/commerce-media/products/p/m.png",
    );
    expect(local.publicUrl("a b/c.png")).toBe("http://localhost:8333/commerce-media/a%20b/c.png");
  });
});
