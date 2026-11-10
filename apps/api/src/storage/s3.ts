// The S3 implementation of the storage interface (ADR-0014). It works against AWS S3 and against
// the local SeaweedFS S3 gateway in docker-compose alike; `forcePathStyle` is the only difference.
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Storage, StorageConfig } from "./index.ts";
import { StorageObjectNotFoundError } from "./index.ts";

/** S3 reports a missing key or bucket as a 404; the model class names vary by operation. */
function isNotFound(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return true;
    if ("name" in error) {
      const name = (error as { name?: unknown }).name;
      return name === "NoSuchKey" || name === "NotFound" || name === "NoSuchBucket";
    }
  }
  return false;
}

/** A concurrent `ensureBucket` may have created it first; that is success, not failure. */
function isAlreadyExists(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists";
  }
  return false;
}

/** `a b/c.png` → `a%20b/c.png`: keys are ours, but encode each segment like a URL path. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function createS3Storage(config: StorageConfig): Storage {
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint !== undefined && {
      endpoint: config.endpoint,
      // The local server addresses buckets as path segments, not subdomains.
      forcePathStyle: true,
    }),
    ...(config.accessKeyId !== undefined &&
      config.secretAccessKey !== undefined && {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
  });

  return {
    async putObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async getObject(key) {
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        if (!response.Body) throw new StorageObjectNotFoundError(key);
        return await response.Body.transformToByteArray();
      } catch (error) {
        if (isNotFound(error)) throw new StorageObjectNotFoundError(key);
        throw error;
      }
    },

    async deleteObject(key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
      } catch (error) {
        // S3 answers a delete of a missing key with 204; tolerate servers that report 404.
        if (!isNotFound(error)) throw error;
      }
    },

    publicUrl(key) {
      return `${config.publicUrl}/${encodeKey(key)}`;
    },

    async ensureBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      } catch (error) {
        if (!isNotFound(error)) throw error;
        try {
          await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
        } catch (createError) {
          if (!isAlreadyExists(createError)) throw createError;
        }
      }
    },
  };
}
