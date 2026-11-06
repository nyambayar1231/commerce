import { runMigrations } from "@commerce/db/migrate";
import postgres from "postgres";

// Runs once before all test files: makes sure the test database exists and is migrated with
// the same migrations as dev, so the two can't drift.
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
