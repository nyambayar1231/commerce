import { describe, expect, it } from "vitest";
import { readAllowedClientHosts, validateRedirectUrl } from "./confirmation.ts";
import {
  ACCOUNT_CONFIRM_SALT,
  checkToken,
  makeToken,
  readSecretKey,
  TOKEN_TIMEOUT_SECONDS,
  type TokenUser,
} from "./tokens.ts";

// Stateless account tokens (PLAN M8 decision 5) and the redirect URL rule (decision 6).
const SECRET = "x".repeat(40);
const user: TokenUser = {
  id: "0190e1c4-0000-7000-8000-000000000001",
  email: "bat@example.com",
  passwordHash: "$argon2id$hash",
  lastLogin: null,
  isConfirmed: false,
};
const now = new Date("2026-11-12T10:00:00Z");
const check = (token: string, changed: Partial<TokenUser> = {}, at = now) =>
  checkToken({ ...user, ...changed }, token, ACCOUNT_CONFIRM_SALT, SECRET, at);

describe("account tokens", () => {
  const token = makeToken(user, ACCOUNT_CONFIRM_SALT, SECRET, now);

  it("look like Django's: base-36 timestamp, dash, 32 hex characters", () => {
    expect(token).toMatch(/^[0-9a-z]+-[0-9a-f]{32}$/);
    expect(check(token)).toBe(true);
  });

  it("stop working when the user's state changes", () => {
    expect(check(token, { isConfirmed: true })).toBe(false);
    expect(check(token, { email: "other@example.com" })).toBe(false);
    expect(check(token, { passwordHash: "$argon2id$new" })).toBe(false);
    expect(check(token, { lastLogin: new Date("2026-11-12T09:00:00Z") })).toBe(false);
    expect(check(token, { id: "0190e1c4-0000-7000-8000-000000000002" })).toBe(false);
  });

  it("expire after three days and can't come from the future", () => {
    const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);
    expect(check(token, {}, later(TOKEN_TIMEOUT_SECONDS))).toBe(true);
    expect(check(token, {}, later(TOKEN_TIMEOUT_SECONDS + 1))).toBe(false);
    expect(check(token, {}, later(-1))).toBe(false);
  });

  it("are tied to their purpose, the secret and every character", () => {
    expect(checkToken(user, token, "another purpose", SECRET, now)).toBe(false);
    expect(checkToken(user, token, ACCOUNT_CONFIRM_SALT, "y".repeat(40), now)).toBe(false);
    const last = token.at(-1) === "0" ? "1" : "0";
    expect(check(`${token.slice(0, -1)}${last}`)).toBe(false);
    expect(check("")).toBe(false);
    expect(check(`zzzzzzzzzzzzzzzzz-${"0".repeat(32)}`)).toBe(false);
  });

  it("need a SECRET_KEY of at least 32 characters", () => {
    expect(() => readSecretKey({})).toThrow("SECRET_KEY is not set");
    expect(() => readSecretKey({ SECRET_KEY: "short" })).toThrow("at least 32");
    expect(readSecretKey({ SECRET_KEY: SECRET })).toBe(SECRET);
  });
});

describe("redirect URLs", () => {
  it("allow Saleor's DEBUG default hosts when ALLOWED_CLIENT_HOSTS is unset", () => {
    expect(readAllowedClientHosts({})).toEqual(["localhost", "127.0.0.1"]);
    expect(readAllowedClientHosts({ ALLOWED_CLIENT_HOSTS: " Shop.mn, .example.com " })).toEqual([
      "shop.mn",
      ".example.com",
    ]);
  });

  it("accept exact hosts, dotted subdomain patterns and *", () => {
    const allowed = ["shop.mn", ".example.com"];
    expect(validateRedirectUrl("https://shop.mn/confirm", allowed)).toBeNull();
    expect(validateRedirectUrl("https://www.example.com/c", allowed)).toBeNull();
    expect(validateRedirectUrl("https://example.com/c", allowed)).toBeNull();
    expect(validateRedirectUrl("https://evilexample.com/c", allowed)).toMatch(/not allowed/);
    expect(validateRedirectUrl("https://shop.mn.evil.io/c", allowed)).toMatch(/not allowed/);
    expect(validateRedirectUrl("https://anything.io/c", ["*"])).toBeNull();
    expect(validateRedirectUrl("ftp://shop.mn/c", allowed)).toMatch(/RFC 1808/);
    expect(validateRedirectUrl("/relative", allowed)).toMatch(/RFC 1808/);
  });
});
