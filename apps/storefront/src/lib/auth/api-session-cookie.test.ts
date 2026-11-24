import { describe, expect, it } from "vitest";
import { parseApiSessionCookie } from "./api-session-cookie";

// The exact strings `sessionCookie()` and `clearedSessionCookie()` produce in
// apps/api/src/graphql/context.ts:
//   `${SESSION_COOKIE}=${token}; Path=/; Expires=${expiresAt.toUTCString()}; HttpOnly; Secure; SameSite=Lax`
//   `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
const expiresAt = new Date("2026-12-24T10:20:30.000Z");
const TOKEN = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const SET = `session=${TOKEN}; Path=/; Expires=${expiresAt.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
const CLEARED = "session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";

function headersWith(...cookies: string[]): Headers {
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return headers;
}

describe("parseApiSessionCookie", () => {
  it("reads the token and Expires from the API's exact format", () => {
    expect(parseApiSessionCookie(headersWith(SET))).toEqual({ token: TOKEN, expires: expiresAt });
  });
  it("finds the session among several cookies", () => {
    const headers = headersWith("other=1; Path=/", SET, "theme=dark");
    expect(parseApiSessionCookie(headers)?.token).toBe(TOKEN);
  });
  it("ignores a cookie whose name only ends with session", () => {
    expect(parseApiSessionCookie(headersWith(SET.replace("session=", "xsession=")))).toBeNull();
  });
  it("is null for the clearing cookie (empty value, Max-Age=0)", () => {
    expect(parseApiSessionCookie(headersWith(CLEARED))).toBeNull();
  });
  it("is null for Max-Age=0 even with a value", () => {
    expect(parseApiSessionCookie(headersWith(`session=${TOKEN}; Max-Age=0; Expires=x`))).toBeNull();
  });
  it("is null for a missing or unparsable Expires", () => {
    expect(parseApiSessionCookie(headersWith(`session=${TOKEN}; Path=/; HttpOnly`))).toBeNull();
    expect(parseApiSessionCookie(headersWith(`session=${TOKEN}; Expires=not a date`))).toBeNull();
  });
  it("is null when there is no Set-Cookie at all", () => {
    expect(parseApiSessionCookie(new Headers())).toBeNull();
  });
  it("skips a clearing session cookie and takes a later valid one", () => {
    expect(parseApiSessionCookie(headersWith(CLEARED, SET))?.token).toBe(TOKEN);
  });
});
