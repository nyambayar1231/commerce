import { closeDb, getDb } from "@commerce/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { tryBlock } from "./index.ts";

// The rate-limit primitives against the real (test) DB (PLAN M9.3, M10.1).
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE rate_limit");
});

afterAll(async () => {
  await closeDb();
});

describe("tryBlock", () => {
  it("lets exactly one of many simultaneous claims win", async () => {
    // Separate pool connections, so the statements really run side by side in Postgres.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => tryBlock(db, "test:block", 60)),
    );
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(results.filter((r) => r instanceof Date)).toHaveLength(9);
  });

  it("can be claimed again once the block expired", async () => {
    expect(await tryBlock(db, "test:block", 60)).toBeNull();
    expect(await tryBlock(db, "test:block", 60)).toBeInstanceOf(Date);
    await db.execute(sql`update rate_limit set expires_at = now() - interval '1 second'`);
    expect(await tryBlock(db, "test:block", 60)).toBeNull();
  });
});
