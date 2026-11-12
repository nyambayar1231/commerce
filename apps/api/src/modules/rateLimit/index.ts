// Adapted from saleor-core: saleor/account/throttling.py (add_block, override_block,
// increment_attempt, clear_cache) (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Rate-limit primitives over the `rate_limit` table (PLAN M9.3): Saleor's cache operations, each
// one atomic SQL statement so concurrent requests (and several API instances) can't both win.
// A row whose `expires_at` passed counts as absent.
import { type Executor, schema } from "@commerce/db";
import { inArray, lt, or, sql } from "drizzle-orm";

const { rateLimit } = schema;

/**
 * Saleor's `add_block` (cache.add): blocks `key` for `seconds` unless it is already blocked.
 * Returns null when the block was added, or the time the existing block ends.
 */
export async function tryBlock(db: Executor, key: string, seconds: number): Promise<Date | null> {
  const added = await db
    .insert(rateLimit)
    .values({ key, count: 0, expiresAt: sql`now() + make_interval(secs => ${seconds})` })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: 0, expiresAt: sql`excluded.expires_at` },
      setWhere: sql`${rateLimit.expiresAt} <= now()`,
    })
    .returning({ key: rateLimit.key });
  if (added.length > 0) return null;
  const [existing] = await db
    .select({ expiresAt: rateLimit.expiresAt })
    .from(rateLimit)
    .where(sql`${rateLimit.key} = ${key}`);
  // Gone in between (expired and deleted): report the shortest block.
  return existing?.expiresAt ?? new Date(Date.now() + seconds * 1000);
}

/** Saleor's `override_block` (cache.set): blocks `key` for `seconds` from now, whatever was there. */
export async function setBlock(db: Executor, key: string, seconds: number): Promise<void> {
  await db
    .insert(rateLimit)
    .values({ key, count: 0, expiresAt: sql`now() + make_interval(secs => ${seconds})` })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: 0, expiresAt: sql`excluded.expires_at` },
    });
}

/**
 * Saleor's `increment_attempt`: adds one to the counter `key` and returns the new count. A new (or
 * expired) counter starts at 1 and lives `ttlSeconds`; incrementing keeps its expiry, as cache.incr.
 */
export async function increment(db: Executor, key: string, ttlSeconds: number): Promise<number> {
  const [row] = await db
    .insert(rateLimit)
    .values({ key, count: 1, expiresAt: sql`now() + make_interval(secs => ${ttlSeconds})` })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.expiresAt} <= now() then 1 else ${rateLimit.count} + 1 end`,
        expiresAt: sql`case when ${rateLimit.expiresAt} <= now() then excluded.expires_at else ${rateLimit.expiresAt} end`,
      },
    })
    .returning({ count: rateLimit.count });
  if (!row) throw new Error("rate_limit upsert returned no row");
  return row.count;
}

/** Saleor's `clear_cache`: removes `keys`, and every expired row while at it. */
export async function clear(db: Executor, keys: string[]): Promise<void> {
  await db
    .delete(rateLimit)
    .where(or(inArray(rateLimit.key, keys), lt(rateLimit.expiresAt, sql`now()`)));
}
