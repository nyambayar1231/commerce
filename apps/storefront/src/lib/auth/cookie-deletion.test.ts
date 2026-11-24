import { ResponseCookies } from "next/dist/server/web/spec-extension/cookies";
import { describe, expect, it, vi } from "vitest";

// Serializes through Next's real ResponseCookies: a browser ignores the deletion of a `__Host-`
// cookie unless the Set-Cookie carries `Secure` and `Path=/`, so signing out on https would
// otherwise leave the session in place.
const headers = new Headers();
const jar = new ResponseCookies(headers);
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ storefrontUrl: "https://dino-craft.lol" }) }));

const auth = await import("./cookies");
const cart = await import("@/lib/cart/cookies");

describe("clearing the cookies on https", () => {
  it("sends Secure, Path=/ and an expired date for both __Host- cookies", async () => {
    await auth.clearSessionCookie();
    await cart.clearCheckoutCookie();
    const lines = headers.getSetCookie();
    for (const name of ["__Host-session", "__Host-checkout"]) {
      const line = lines.find((l) => l.startsWith(`${name}=;`));
      expect(line, name).toBeDefined();
      expect(line).toMatch(/; Path=\/(;|$)/);
      expect(line).toMatch(/; Secure(;|$)/);
      expect(line).toMatch(/; HttpOnly(;|$)/);
      expect(line).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(line).not.toMatch(/Domain=/i);
    }
  });
});
