// Database client for the whole monorepo (pattern adapted from dino-publishing/packages/db).
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

let cached: ReturnType<typeof create> | undefined;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");

  // postgres.js keeps a pool of up to `max` connections and lends one to each query.
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

/** Lazy, so importing this package never opens a connection by itself. */
export function getDb() {
  cached ??= create();
  return cached;
}

/**
 * Closes the pool. Open sockets keep the Node process alive, so scripts and the server's
 * shutdown handler must call this. `timeout` lets running queries finish first.
 */
export async function closeDb(): Promise<void> {
  const db = cached;
  if (!db) return;
  cached = undefined;
  await db.$client.end({ timeout: 5 });
}

/** Never throws; used by the ping script now and a health check later. */
export async function checkDbConnection(db: Executor): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Domain functions take an `Executor` instead of calling `getDb()`, so they can run on their
 * own or inside a caller's transaction (e.g. checkout completion, ARCHITECTURE.md §5.4).
 * A function that *requires* a transaction takes `Tx`: `Db` is not assignable to `Tx`, so
 * calling it outside a transaction is a compile error.
 */
export type Executor = Db | Tx;
