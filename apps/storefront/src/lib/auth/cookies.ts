import "server-only";

import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

/** `__Host-` prefix (Secure, Path=/, no Domain) when the storefront is served over https. */
export function sessionCookieName(): string {
  // A function, not a constant: the environment is read at runtime, never while building.
  return getEnv().storefrontUrl.startsWith("https:") ? "__Host-session" : "session";
}

/** The session token, or null when the shopper has none. Reading it makes the render dynamic. */
export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(sessionCookieName())?.value ?? null;
}
