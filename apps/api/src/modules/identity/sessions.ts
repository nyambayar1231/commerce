import { createHash, randomBytes } from "node:crypto";
import { type Executor, schema } from "@commerce/db";
import { eq } from "drizzle-orm";

// Opaque, DB-backed login sessions (ADR-0006, ARCHITECTURE.md §7). The client gets a random
// 256-bit token; the table stores only its SHA-256 hash. A session ends when it has been idle for
// 14 days (sliding, via `last_seen_at`), when its hard cap `expires_at` passes, when its user is
// deactivated, or when it is revoked (row deleted).

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TIMEOUT_MS = 14 * DAY_MS;
// Hard cap on total lifetime, matching Saleor's refresh-token lifetime
// (../saleor-core/saleor/settings.py, JWT_TTL_REFRESH = 30 days).
export const SESSION_MAX_AGE_MS = 30 * DAY_MS;
// `last_seen_at` is only rewritten when it is older than this, so ordinary requests don't each
// cost a write. Negligible against a 14-day idle window.
const LAST_SEEN_RESOLUTION_MS = 5 * 60 * 1000;

// 32 random bytes as base64url = 43 characters.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isStaff: boolean;
  isSuperuser: boolean;
  isActive: boolean;
  isConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
};

/** The `user` columns every read of a SessionUser selects (sessions, login, loaders, GraphQL). */
export const SESSION_USER_COLUMNS = {
  id: schema.user.id,
  email: schema.user.email,
  firstName: schema.user.firstName,
  lastName: schema.user.lastName,
  isStaff: schema.user.isStaff,
  isSuperuser: schema.user.isSuperuser,
  isActive: schema.user.isActive,
  isConfirmed: schema.user.isConfirmed,
  createdAt: schema.user.createdAt,
  updatedAt: schema.user.updatedAt,
  lastLogin: schema.user.lastLogin,
};

export type CreatedSession = { token: string; expiresAt: Date };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  db: Executor,
  userId: string,
  now: Date = new Date(),
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);
  await db.insert(schema.session).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  });
  return { token, expiresAt };
}

// Returns the session's user, or null when the token is unknown, malformed, expired, or belongs to
// an inactive user. Ended sessions are deleted on the way out.
export async function getSessionUser(
  db: Executor,
  token: string,
  now: Date = new Date(),
): Promise<SessionUser | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const [row] = await db
    .select({
      sessionId: schema.session.id,
      expiresAt: schema.session.expiresAt,
      lastSeenAt: schema.session.lastSeenAt,
      isActive: schema.user.isActive,
      user: SESSION_USER_COLUMNS,
    })
    .from(schema.session)
    .innerJoin(schema.user, eq(schema.user.id, schema.session.userId))
    .where(eq(schema.session.tokenHash, hashToken(token)));

  if (!row) return null;

  const t = now.getTime();
  const ended =
    t >= row.expiresAt.getTime() ||
    t >= row.lastSeenAt.getTime() + SESSION_IDLE_TIMEOUT_MS ||
    !row.isActive;
  if (ended) {
    await db.delete(schema.session).where(eq(schema.session.id, row.sessionId));
    return null;
  }

  if (t - row.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS) {
    await db
      .update(schema.session)
      .set({ lastSeenAt: now })
      .where(eq(schema.session.id, row.sessionId));
  }
  return row.user;
}

// Ends the session for this token (logout). Unknown tokens are a no-op.
export async function revokeSession(db: Executor, token: string): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) return;
  await db.delete(schema.session).where(eq(schema.session.tokenHash, hashToken(token)));
}
