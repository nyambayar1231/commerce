import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const production = {
  NODE_ENV: "production",
  API_URL: "http://api:4000",
  STOREFRONT_URL: "https://dino-craft.lol",
};

describe("parseEnv", () => {
  it("defaults in development", () => {
    expect(parseEnv({ NODE_ENV: "development" })).toEqual({
      apiUrl: "http://localhost:4000",
      storefrontUrl: "http://localhost:3000",
      trustProxy: false,
      imageOrigins: ["http://localhost:4000", "http://localhost:8333"],
      paymentProviders: ["dummy"],
      production: false,
    });
  });

  it("has no image origins by default in production, and an empty value means none", () => {
    expect(parseEnv(production).imageOrigins).toEqual([]);
    expect(parseEnv({ NODE_ENV: "development", IMAGE_ORIGINS: "" }).imageOrigins).toEqual([]);
  });

  it("accepts a complete production configuration", () => {
    const env = parseEnv({
      ...production,
      TRUST_PROXY: "true",
      IMAGE_ORIGINS: "https://a.example.com, http://localhost:8333",
      PAYMENT_PROVIDERS: "wire",
    });
    expect(env.trustProxy).toBe(true);
    expect(env.imageOrigins).toEqual(["https://a.example.com", "http://localhost:8333"]);
    expect(env.production).toBe(true);
  });

  it("keeps the test payment out of production unless a demo allows it", () => {
    expect(parseEnv(production).paymentProviders).toEqual([]);
    expect(() => parseEnv({ ...production, PAYMENT_PROVIDERS: "dummy" })).toThrow(
      /must not enable "dummy" in production/,
    );
    expect(
      parseEnv({ ...production, PAYMENT_PROVIDERS: "dummy", ALLOW_DUMMY_PAYMENTS: "true" })
        .paymentProviders,
    ).toEqual(["dummy"]);
  });

  it("requires API_URL and STOREFRONT_URL in production, naming both", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/API_URL is not set/);
    expect(() => parseEnv({ NODE_ENV: "production", API_URL: "http://api:4000" })).toThrow(
      /STOREFRONT_URL is not set/,
    );
    expect(() => parseEnv({ ...production, STOREFRONT_URL: "" })).toThrow(/STOREFRONT_URL/);
  });

  it("rejects bad URLs, a trailing slash and a path in the origin", () => {
    expect(() => parseEnv({ ...production, API_URL: "not a url" })).toThrow(/API_URL/);
    expect(() => parseEnv({ ...production, API_URL: "ftp://api:4000" })).toThrow(/API_URL/);
    expect(() => parseEnv({ ...production, API_URL: "http://api:4000/" })).toThrow(
      /trailing|slash/,
    );
    expect(() => parseEnv({ ...production, STOREFRONT_URL: "https://shop.example/x" })).toThrow(
      /STOREFRONT_URL/,
    );
    expect(() => parseEnv({ ...production, IMAGE_ORIGINS: "https://a.example/path" })).toThrow(
      /IMAGE_ORIGINS/,
    );
  });

  it("rejects a bad boolean and an unknown payment provider", () => {
    expect(() => parseEnv({ ...production, TRUST_PROXY: "yes" })).toThrow(/TRUST_PROXY/);
    expect(() => parseEnv({ ...production, PAYMENT_PROVIDERS: "dummy,stripe" })).toThrow(
      /PAYMENT_PROVIDERS/,
    );
  });

  it("never echoes a value", () => {
    const secret = "super-secret-value";
    for (const bad of [
      { API_URL: secret },
      { STOREFRONT_URL: secret },
      { TRUST_PROXY: secret },
      { IMAGE_ORIGINS: secret },
      { PAYMENT_PROVIDERS: secret },
    ]) {
      let message = "";
      try {
        parseEnv({ ...production, ...bad });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(secret);
    }
  });
});
