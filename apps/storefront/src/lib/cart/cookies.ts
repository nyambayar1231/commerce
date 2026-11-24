import "server-only";

import { cookies } from "next/headers";
import { cookieFlags } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/env";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `__Host-` prefix when the storefront is served over https, as the session cookie. */
export function checkoutCookieName(): string {
  return getEnv().storefrontUrl.startsWith("https:") ? "__Host-checkout" : "checkout";
}

/** The checkout token (a UUID), or null when there is none or the value is not a UUID. */
export async function readCheckoutToken(): Promise<string | null> {
  const value = (await cookies()).get(checkoutCookieName())?.value;
  return value !== undefined && UUID.test(value) ? value : null;
}

export async function setCheckoutCookie(token: string): Promise<void> {
  (await cookies()).set(checkoutCookieName(), token, {
    ...cookieFlags(),
    expires: new Date(Date.now() + THIRTY_DAYS_MS),
  });
}

/** Deletes with the cookie's own flags (see `clearSessionCookie`). */
export async function clearCheckoutCookie(): Promise<void> {
  (await cookies()).delete({ name: checkoutCookieName(), ...cookieFlags() });
}

/** The API's global ID of a checkout: base64("Checkout:<token>"); the token is the checkout's pk. */
export function checkoutGlobalId(token: string): string {
  return Buffer.from(`Checkout:${token}`).toString("base64");
}
