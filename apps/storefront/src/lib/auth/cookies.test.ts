import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();
const del = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set, delete: del, get: vi.fn() }) }));

const SOURCE = { current: "http://localhost:3007" };
vi.mock("@/lib/env", () => ({ getEnv: () => ({ storefrontUrl: SOURCE.current }) }));

const auth = await import("./cookies");
const cart = await import("@/lib/cart/cookies");

beforeEach(() => {
  set.mockClear();
  del.mockClear();
});

describe("session cookie", () => {
  it("is HttpOnly, SameSite=Lax, Path=/ and not Secure on http, named session", async () => {
    SOURCE.current = "http://localhost:3007";
    const expires = new Date("2026-12-24T00:00:00Z");
    await auth.setSessionCookie("tok", expires);
    expect(set).toHaveBeenCalledWith("session", "tok", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      expires,
    });
  });
  it("is Secure and __Host- prefixed on https", async () => {
    SOURCE.current = "https://dino-craft.lol";
    const expires = new Date("2026-12-24T00:00:00Z");
    await auth.setSessionCookie("tok", expires);
    expect(set).toHaveBeenCalledWith("__Host-session", "tok", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      expires,
    });
    await auth.clearSessionCookie();
    expect(del).toHaveBeenCalledWith({
      name: "__Host-session",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
    await cart.clearCheckoutCookie();
    expect(del).toHaveBeenCalledWith({
      name: "__Host-checkout",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
  });
});

describe("checkout cookie", () => {
  it("has the same flags, 30 days, and the __Host- prefix on https", async () => {
    SOURCE.current = "https://dino-craft.lol";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T00:00:00Z"));
    await cart.setCheckoutCookie("9b2f6c1e-8d4a-4e3b-9a7c-1f2e3d4c5b6a");
    vi.useRealTimers();
    expect(set).toHaveBeenCalledWith("__Host-checkout", "9b2f6c1e-8d4a-4e3b-9a7c-1f2e3d4c5b6a", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      expires: new Date("2026-12-24T00:00:00Z"),
    });
  });
  it("is named checkout on http", () => {
    SOURCE.current = "http://localhost:3007";
    expect(cart.checkoutCookieName()).toBe("checkout");
  });
  it("global id is base64 of Checkout:<token>", () => {
    expect(Buffer.from(cart.checkoutGlobalId("abc"), "base64").toString()).toBe("Checkout:abc");
  });
});
