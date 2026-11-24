const AUTH_PAGES = new Set(["/login", "/signup"]);
const BASE = "http://same-origin.invalid";

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * The path (plus query) of `value` when it is a safe same-site relative redirect target, else
 * `fallback`. Accepts only a string that starts with exactly one `/`, with no backslash, encoded
 * slash or backslash (`%2f`, `%5c`), control character or `//` after it, that parses as a
 * same-origin relative URL and is not a sign-in page (a redirect loop).
 */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.includes("//") || value.includes("\\") || /%2f|%5c/i.test(value)) return fallback;
  if (hasControlCharacter(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  if (AUTH_PAGES.has(url.pathname.replace(/\/+$/, "") || "/")) return fallback;
  return `${url.pathname}${url.search}`;
}
