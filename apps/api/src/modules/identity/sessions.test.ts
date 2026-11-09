import { createHash } from "node:crypto";
import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSession, getSessionUser, revokeSession } from "./index.ts";
import { SESSION_IDLE_TIMEOUT_MS, SESSION_MAX_AGE_MS } from "./sessions.ts";

// The real (test) database. Time is passed in explicitly, so expiry is tested without waiting.
const db = getDb();
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-01-01T00:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

let userId: string;

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user" CASCADE');
  const [u] = await db
    .insert(schema.user)
    .values({ email: "staff@example.com", isStaff: true })
    .returning({ id: schema.user.id });
  if (!u) throw new Error("no user");
  userId = u.id;
});

afterAll(async () => {
  await closeDb();
});

const sessionRows = () => db.select().from(schema.session);

describe("sessions", () => {
  it("creates a 256-bit token, stores only its SHA-256 hash, and resolves it to the user", async () => {
    const { token, expiresAt } = await createSession(db, userId, T0);

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(expiresAt).toEqual(at(SESSION_MAX_AGE_MS));
    const [row] = await sessionRows();
    expect(row?.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(row?.tokenHash).not.toContain(token);

    const user = await getSessionUser(db, token, at(DAY_MS));
    expect(user).toMatchObject({ id: userId, email: "staff@example.com", isStaff: true });
  });

  it("gives every session a different token", async () => {
    const a = await createSession(db, userId, T0);
    const b = await createSession(db, userId, T0);
    expect(a.token).not.toBe(b.token);
  });

  it("returns null for unknown and malformed tokens", async () => {
    await createSession(db, userId, T0);
    expect(await getSessionUser(db, "A".repeat(43), T0)).toBeNull();
    expect(await getSessionUser(db, "", T0)).toBeNull();
    expect(await getSessionUser(db, "not a token", T0)).toBeNull();
  });

  it("slides: activity within 14 days keeps the session alive past the first 14 days", async () => {
    const { token } = await createSession(db, userId, T0);
    expect(await getSessionUser(db, token, at(10 * DAY_MS))).not.toBeNull();
    expect(await getSessionUser(db, token, at(20 * DAY_MS))).not.toBeNull();
  });

  it("ends after 14 idle days and deletes the row", async () => {
    const { token } = await createSession(db, userId, T0);
    expect(await getSessionUser(db, token, at(SESSION_IDLE_TIMEOUT_MS))).toBeNull();
    expect(await sessionRows()).toHaveLength(0);
  });

  it("ends at the hard cap even when used every day", async () => {
    const { token } = await createSession(db, userId, T0);
    for (let day = 7; day < 30; day += 7) {
      expect(await getSessionUser(db, token, at(day * DAY_MS))).not.toBeNull();
    }
    expect(await getSessionUser(db, token, at(SESSION_MAX_AGE_MS))).toBeNull();
  });

  it("only rewrites last_seen_at when it is more than 5 minutes old", async () => {
    const { token } = await createSession(db, userId, T0);
    await getSessionUser(db, token, at(60_000));
    expect((await sessionRows())[0]?.lastSeenAt).toEqual(T0);
    await getSessionUser(db, token, at(DAY_MS));
    expect((await sessionRows())[0]?.lastSeenAt).toEqual(at(DAY_MS));
  });

  it("rejects and deletes the session of a deactivated user", async () => {
    const { token } = await createSession(db, userId, T0);
    await db.update(schema.user).set({ isActive: false }).where(eq(schema.user.id, userId));
    expect(await getSessionUser(db, token, T0)).toBeNull();
    expect(await sessionRows()).toHaveLength(0);
  });

  it("revokes only the given session", async () => {
    const a = await createSession(db, userId, T0);
    const b = await createSession(db, userId, T0);
    await revokeSession(db, a.token);
    expect(await getSessionUser(db, a.token, T0)).toBeNull();
    expect(await getSessionUser(db, b.token, T0)).not.toBeNull();
    await revokeSession(db, "garbage"); // no-op
  });

  it("deletes sessions with their user", async () => {
    await createSession(db, userId, T0);
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    expect(await sessionRows()).toHaveLength(0);
  });
});
