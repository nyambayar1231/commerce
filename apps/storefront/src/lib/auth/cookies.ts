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

/** Flags shared by the session and checkout cookies (ARCHITECTURE §10.8). */
export function cookieFlags(): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: getEnv().storefrontUrl.startsWith("https:"),
  };
}

/** Stores the API session token, for as long as the API session lasts. */
export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  (await cookies()).set(sessionCookieName(), token, { ...cookieFlags(), expires });
}

/**
 * Deletes with the same flags it was set with: a browser ignores a `__Host-` cookie's deletion
 * that lacks `Secure` and `Path=/`, which would leave the shopper signed in after signing out.
 */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: sessionCookieName(), ...cookieFlags() });
}
