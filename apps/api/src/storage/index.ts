// The one storage interface of ADR-0014. Product media lives in S3-compatible object storage;
// dev and tests talk to SeaweedFS in docker-compose through the same code as production AWS S3.
// Everything here is lazy: importing the module never reads the environment or opens a connection
// (the same rule as `@commerce/db`'s `getDb()`).
import { createS3Storage } from "./s3.ts";

/** Saleor's `ThumbnailFormat`; ORIGINAL keeps the source image's format. */
export type ThumbnailFormat = "ORIGINAL" | "WEBP" | "AVIF";

/** Everything `createS3Storage` needs. `readStorageConfig` builds it from the environment. */
export interface StorageConfig {
  bucket: string;
  /** Unset for AWS S3; the local SeaweedFS endpoint in dev and tests (path-style addressing). */
  endpoint?: string;
  region: string;
  /** Unset → the SDK's default credential chain (instance role, `~/.aws`, …). */
  accessKeyId?: string;
  secretAccessKey?: string;
  /** The base URL objects are served from, without a trailing slash (ADR-0014). */
  publicUrl: string;
}

/** The API's only storage abstraction (ADR-0014): one implementation, AWS S3 or S3-compatible. */
export interface Storage {
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Throws `StorageObjectNotFoundError` when the key does not exist. */
  getObject(key: string): Promise<Uint8Array>;
  /** A missing key is not an error. */
  deleteObject(key: string): Promise<void>;
  /** The public URL of a key, each path segment URL-encoded. */
  publicUrl(key: string): string;
  /** Creates the bucket when it is missing; idempotent. */
  ensureBucket(): Promise<void>;
}

/** `getObject` for a key that is not in the bucket. */
export class StorageObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = "StorageObjectNotFoundError";
  }
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set (copy .env.example to .env)`);
  }
  return value;
}

/** Reads the storage configuration; a missing required variable is named in the error. */
export function readStorageConfig(
  env: Record<string, string | undefined> = process.env,
): StorageConfig {
  const bucket = required(env, "AWS_MEDIA_BUCKET_NAME");
  // Strip trailing slashes so `publicUrl` can join with a single "/".
  const publicUrl = required(env, "MEDIA_PUBLIC_URL").replace(/\/+$/, "");

  const accessKeyId = env.AWS_ACCESS_KEY_ID || undefined;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY || undefined;
  // Both or neither: half a pair would fail deep inside the SDK's request signing.
  if (accessKeyId !== undefined && secretAccessKey === undefined) {
    throw new Error("AWS_SECRET_ACCESS_KEY is not set (required with AWS_ACCESS_KEY_ID)");
  }
  if (accessKeyId === undefined && secretAccessKey !== undefined) {
    throw new Error("AWS_ACCESS_KEY_ID is not set (required with AWS_SECRET_ACCESS_KEY)");
  }

  return {
    bucket,
    endpoint: env.AWS_S3_ENDPOINT_URL || undefined,
    region: env.AWS_S3_REGION_NAME || "us-east-1",
    accessKeyId,
    secretAccessKey,
    publicUrl,
  };
}

/** `products/<productId>/<mediaId>.<ext>`; `ext` is without the dot (ADR-0014). */
export function productMediaKey(productId: string, mediaId: string, ext: string): string {
  return `products/${productId}/${mediaId}.${ext}`;
}

/**
 * `thumbnails/<mediaId>/<size>.<ext>`. WEBP/AVIF name the format; ORIGINAL keeps the source
 * image's extension, so the caller passes it.
 */
export function thumbnailKey(
  mediaId: string,
  size: number,
  format: ThumbnailFormat,
  sourceExt?: string,
): string {
  let ext: string;
  if (format === "ORIGINAL") {
    if (sourceExt === undefined || sourceExt === "") {
      throw new Error("thumbnailKey: sourceExt is required for the ORIGINAL format");
    }
    ext = sourceExt;
  } else {
    ext = format.toLowerCase();
  }
  return `thumbnails/${mediaId}/${size}.${ext}`;
}

let cached: Storage | undefined;

/** Lazy singleton from the environment, like `getDb()`: missing variables fail on first use. */
export function getStorage(): Storage {
  if (!cached) cached = createS3Storage(readStorageConfig(process.env));
  return cached;
}

export { createS3Storage } from "./s3.ts";
