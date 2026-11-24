const API_SESSION_COOKIE = "session";

/**
 * The session token and expiry in the API's `Set-Cookie: session=…` header (the API sets it on
 * `tokenCreate` and `setPassword`; see `sessionCookie()` in apps/api/src/graphql/context.ts).
 * Returns null when there is none, or only a clearing cookie (empty value, `Max-Age=0`) or a bad
 * date.
 */
export function parseApiSessionCookie(headers: Headers): { token: string; expires: Date } | null {
  for (const line of headers.getSetCookie()) {
    const [pair = "", ...attributes] = line.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (separator === -1 || pair.slice(0, separator) !== API_SESSION_COOKIE) continue;
    const token = pair.slice(separator + 1);
    if (token === "") continue;

    let expires: Date | null = null;
    let cleared = false;
    for (const attribute of attributes) {
      const eq = attribute.indexOf("=");
      const name = (eq === -1 ? attribute : attribute.slice(0, eq)).toLowerCase();
      const value = eq === -1 ? "" : attribute.slice(eq + 1);
      if (name === "max-age" && Number(value) <= 0) cleared = true;
      if (name === "expires") expires = new Date(value);
    }
    if (cleared || expires === null || Number.isNaN(expires.getTime())) continue;
    return { token, expires };
  }
  return null;
}
