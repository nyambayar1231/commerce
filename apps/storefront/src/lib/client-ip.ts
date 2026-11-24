import "server-only";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * Same rule as the API's `clientIp.ts` (ARCHITECTURE §10.2): behind our own proxy the last
 * `X-Forwarded-For` entry, the one the proxy added; earlier entries are client-forged. Without
 * trust, null (the storefront's own socket address would be the same for every shopper).
 */
export function clientIpFrom(requestHeaders: Headers, trustProxy: boolean): string | null {
  if (!trustProxy) return null;
  const entries = (requestHeaders.get("x-forwarded-for") ?? "").split(",");
  const last = entries[entries.length - 1]?.trim() ?? "";
  return isIP(last) !== 0 ? last : null;
}

export async function getClientIp(): Promise<string | null> {
  return clientIpFrom(await headers(), getEnv().trustProxy);
}
