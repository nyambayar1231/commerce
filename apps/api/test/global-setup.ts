import { runMigrations } from "@commerce/db/migrate";
import postgres from "postgres";
import { createS3Storage, readStorageConfig } from "../src/storage/index.ts";

// Runs once before all test files: makes sure the test database exists and is migrated with
// the same migrations as dev, so the two can't drift. Also creates the media test bucket
// (ADR-0014): tests talk to the real S3 server, not a mock.
export async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");

  // Safety net: tests will later truncate tables, which must never hit the dev database.
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${name}": name must end in _test`);
  }

  await createDatabaseIfMissing(url, name);
  await runMigrations(url);
  await ensureMediaBucket();
}

async function createDatabaseIfMissing(url: string, name: string): Promise<void> {
  // CREATE DATABASE must be issued from another database on the same server.
  const serverUrl = new URL(url);
  serverUrl.pathname = "/postgres";
  const sql = postgres(serverUrl.toString(), { max: 1 });
  try {
    const existing = await sql`select 1 from pg_database where datname = ${name}`;
    if (existing.length === 0) await sql.unsafe(`create database "${name}"`);
  } finally {
    await sql.end();
  }
}

async function ensureMediaBucket(): Promise<void> {
  const bucket = process.env.AWS_MEDIA_BUCKET_NAME_TEST;
  if (!bucket) throw new Error("AWS_MEDIA_BUCKET_NAME_TEST is not set (see .env.example)");

  // Same safety net as the database above: the dev bucket must never be visible to tests.
  if (!bucket.endsWith("-test")) {
    throw new Error(`Refusing to use the media bucket "${bucket}": name must end in -test`);
  }

  // The test process reads the same variables production does (apps/api/vitest.config.ts), but
  // with the test bucket: build the config the way that file does.
  const endpoint = (process.env.AWS_S3_ENDPOINT_URL ?? "").replace(/\/+$/, "");
  const storage = createS3Storage(
    readStorageConfig({
      ...process.env,
      AWS_MEDIA_BUCKET_NAME: bucket,
      MEDIA_PUBLIC_URL: `${endpoint}/${bucket}`,
    }),
  );
  await storage.ensureBucket();
}
