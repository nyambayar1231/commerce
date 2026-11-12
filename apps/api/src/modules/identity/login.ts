// Adapted from saleor-core: saleor/account/throttling.py (authenticate_with_throttling,
// get_delay_time) (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { type Executor, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { clear, increment, setBlock, tryBlock } from "../rateLimit/index.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { SESSION_USER_COLUMNS, type SessionUser } from "./sessions.ts";

// Password login, as Saleor's `tokenCreate` decides it
// (../saleor-core/saleor/graphql/account/mutations/authentication/create_token.py): unknown email,
// missing password and wrong password all fail the same way; `ACCOUNT_NOT_CONFIRMED` and `INACTIVE`
// are only reported once the password is right.
//
// Throttled as Saleor (PLAN M9.3): every attempt blocks the client IP for a second, so concurrent
// guesses are refused; each failure extends the block (see `delaySeconds`); a correct password
// clears the IP's counters. Counters live in `rate_limit` (modules/rateLimit).

// Same cap as account creation (users.ts): longer input can't match and is never hashed.
const MAX_PASSWORD_LENGTH = 128;

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; code: "INVALID_CREDENTIALS" | "ACCOUNT_NOT_CONFIRMED" | "INACTIVE" }
  | { ok: false; code: "UNKNOWN_IP_ADDRESS" }
  | { ok: false; code: "LOGIN_ATTEMPT_DELAYED"; nextAttemptAt: Date };

// Saleor's constants: delays between 1 s and 1 h; failure counters expire 2 h after the first one.
const MIN_DELAY = 1;
const MAX_DELAY = 3600;
const ATTEMPT_COUNTER_EXPIRE_TIME = 7200;

const failedIpKey = (ip: string) => `login:fail:ip:${ip}`;
const failedIpUserKey = (ip: string, userId: string) => `login:fail:ip:${ip}:user:${userId}`;
const blockedIpKey = (ip: string) => `login:block:ip:${ip}`;

/**
 * Saleor's get_delay_time: the block after a failure, in seconds. Many failures from one IP for
 * any emails (credential stuffing) double it every 10 failures; failures from one IP for one
 * existing account (brute force) double it every failure. The larger wins.
 */
export function delaySeconds(ipAttempts: number, ipUserAttempts: number): number {
  let ipDelay = 0;
  if (ipAttempts > 0)
    ipDelay = ipAttempts < 100 ? 2 ** (Math.ceil(ipAttempts / 10) - 1) : MAX_DELAY;
  let ipUserDelay = 0;
  if (ipUserAttempts > 0) ipUserDelay = ipUserAttempts < 10 ? 2 ** (ipUserAttempts - 1) : MAX_DELAY;
  return Math.max(ipDelay, ipUserDelay, MIN_DELAY);
}

// Verified against when the email is unknown or has no password, so those answers take as long
// as a wrong password and don't reveal which emails exist. Made once, on first use.
let dummyHash: Promise<string> | undefined;

export async function authenticate(
  db: Executor,
  email: string,
  password: string,
  ip: string | null,
): Promise<LoginResult> {
  if (ip === null) return { ok: false, code: "UNKNOWN_IP_ADDRESS" };

  // Block the IP before checking anything, so concurrent attempts can't run side by side.
  const blockedUntil = await tryBlock(db, blockedIpKey(ip), MIN_DELAY);
  if (blockedUntil !== null) {
    return { ok: false, code: "LOGIN_ATTEMPT_DELAYED", nextAttemptAt: blockedUntil };
  }

  const [row] = await db
    .select({ ...SESSION_USER_COLUMNS, passwordHash: schema.user.passwordHash })
    .from(schema.user)
    .where(eq(schema.user.email, email.trim()));

  let correct = false;
  if (row?.passwordHash && password.length <= MAX_PASSWORD_LENGTH) {
    correct = await verifyPassword(row.passwordHash, password);
  } else if (password.length <= MAX_PASSWORD_LENGTH) {
    dummyHash ??= hashPassword("dummy password for timing");
    await verifyPassword(await dummyHash, password);
  }

  if (!row || !correct) {
    // Saleor counts a failure per IP+account only for an existing account.
    const ipUserAttempts = row
      ? (await increment(db, failedIpUserKey(ip, row.id), ATTEMPT_COUNTER_EXPIRE_TIME)).count
      : 0;
    const ipAttempts = (await increment(db, failedIpKey(ip), ATTEMPT_COUNTER_EXPIRE_TIME)).count;
    await setBlock(db, blockedIpKey(ip), delaySeconds(ipAttempts, ipUserAttempts));
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }
  await clear(db, [failedIpKey(ip), failedIpUserKey(ip, row.id), blockedIpKey(ip)]);

  // Saleor's order: an unconfirmed account (PLAN M8.3) before an inactive one.
  if (!row.isConfirmed) return { ok: false, code: "ACCOUNT_NOT_CONFIRMED" };
  if (!row.isActive) return { ok: false, code: "INACTIVE" };

  // Saleor's update_user_last_login_if_required, on every successful login.
  const { passwordHash: _p, ...user } = row;
  const [updated] = await db
    .update(schema.user)
    .set({ lastLogin: sql`now()` })
    .where(eq(schema.user.id, row.id))
    .returning({ lastLogin: schema.user.lastLogin });
  return { ok: true, user: { ...user, lastLogin: updated?.lastLogin ?? user.lastLogin } };
}
