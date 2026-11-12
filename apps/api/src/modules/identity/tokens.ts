// Adapted from saleor-core: saleor/core/tokens.py (BSD-3-Clause, Copyright (c) 2020-2021, Saleor
// Commerce) and Django's PasswordResetTokenGenerator, which it builds on.
// See THIRD_PARTY_LICENSES.md
// Stateless account tokens (PLAN M8 decision 5): "<timestamp>-<hmac>", where the HMAC covers the
// user's id, email, password hash, last login and confirmation state. Any change to those (the
// account gets confirmed, logs in, changes email or password) invalidates the token, so nothing
// is stored. Each purpose has its own salt, so a token of one kind can't be used for another.
// Unlike Saleor's confirmation generator, ours also hashes `isConfirmed`: a confirmation link
// works once.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Django's PASSWORD_RESET_TIMEOUT default: 3 days. */
export const TOKEN_TIMEOUT_SECONDS = 3 * 24 * 3600;

// Django counts seconds from 2001-01-01 so timestamps stay short in base 36.
const EPOCH_MS = Date.UTC(2001, 0, 1);

export const ACCOUNT_CONFIRM_SALT = "commerce.identity.tokens.account_confirm_token_generator";

export interface TokenUser {
  id: string;
  email: string;
  passwordHash: string | null;
  lastLogin: Date | null;
  isConfirmed: boolean;
}

/** `SECRET_KEY` (Saleor's setting), required wherever tokens are made or checked. */
export function readSecretKey(env: Record<string, string | undefined> = process.env): string {
  const secret = env.SECRET_KEY;
  if (!secret) throw new Error("SECRET_KEY is not set (copy .env.example to .env)");
  if (secret.length < 32) throw new Error("SECRET_KEY must be at least 32 characters");
  return secret;
}

const hashValue = (user: TokenUser, timestamp: number): string =>
  [
    user.id,
    user.passwordHash ?? "",
    // Seconds, as Django drops microseconds: a stored value read back must hash the same.
    user.lastLogin ? Math.floor(user.lastLogin.getTime() / 1000) : "",
    timestamp,
    user.email,
    user.isConfirmed ? "1" : "0",
  ].join("|");

/** Django's salted_hmac(...).hexdigest()[::2]. */
const sign = (salt: string, secret: string, value: string): string => {
  const key = createHash("sha256")
    .update(salt + secret)
    .digest();
  const hex = createHmac("sha256", key).update(value).digest("hex");
  return [...hex].filter((_char, index) => index % 2 === 0).join("");
};

const secondsSinceEpoch = (now: Date) => Math.floor((now.getTime() - EPOCH_MS) / 1000);

export function makeToken(
  user: TokenUser,
  salt: string,
  secret: string,
  now: Date = new Date(),
): string {
  const timestamp = secondsSinceEpoch(now);
  return `${timestamp.toString(36)}-${sign(salt, secret, hashValue(user, timestamp))}`;
}

export function checkToken(
  user: TokenUser,
  token: string,
  salt: string,
  secret: string,
  now: Date = new Date(),
): boolean {
  const match = /^([0-9a-z]{1,13})-([0-9a-f]{32})$/.exec(token);
  if (!match) return false;
  const timestamp = Number.parseInt(match[1] ?? "", 36);
  if (!Number.isSafeInteger(timestamp)) return false;
  const expected = Buffer.from(sign(salt, secret, hashValue(user, timestamp)));
  const given = Buffer.from(match[2] ?? "");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const age = secondsSinceEpoch(now) - timestamp;
  return age >= 0 && age <= TOKEN_TIMEOUT_SECONDS;
}
