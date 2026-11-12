import { describe, expect, it } from "vitest";
import { validateConfig } from "./config.ts";

// A complete development environment, as in .env.example.
const DEV = {
  DATABASE_URL: "postgres://commerce:commerce@localhost:5433/commerce",
  SECRET_KEY: "dev-only-secret-change-me-0123456789abcdef",
  AWS_MEDIA_BUCKET_NAME: "commerce-media",
  AWS_S3_ENDPOINT_URL: "http://localhost:8333",
  AWS_ACCESS_KEY_ID: "commerce",
  AWS_SECRET_ACCESS_KEY: "commerce-dev-secret",
  MEDIA_PUBLIC_URL: "http://localhost:8333/commerce-media",
  ALLOWED_GRAPHQL_ORIGINS: "http://localhost:5173",
  EMAIL_URL: "smtp://localhost:1026",
  DEFAULT_FROM_EMAIL: "noreply@example.com",
};

const PRODUCTION = {
  ...DEV,
  NODE_ENV: "production",
  SECRET_KEY: "f".repeat(64),
  AWS_SECRET_ACCESS_KEY: "real-secret",
  ALLOWED_GRAPHQL_ORIGINS: "https://dashboard.example.com",
  ALLOWED_CLIENT_HOSTS: "shop.example.com",
  PUBLIC_URL: "https://api.example.com",
};

describe("validateConfig", () => {
  it("accepts the development environment for both processes", () => {
    expect(validateConfig("api", DEV)).toEqual([]);
    expect(validateConfig("worker", DEV)).toEqual([]);
  });

  it("accepts a complete production environment", () => {
    expect(validateConfig("api", PRODUCTION)).toEqual([]);
    expect(validateConfig("worker", PRODUCTION)).toEqual([]);
  });

  it("lists every problem at once", () => {
    const problems = validateConfig("api", {});
    expect(problems).toEqual([
      "DATABASE_URL is not set (copy .env.example to .env)",
      "SECRET_KEY is not set (copy .env.example to .env)",
      "AWS_MEDIA_BUCKET_NAME is not set (copy .env.example to .env)",
    ]);
  });

  it("checks only what each process needs", () => {
    const { EMAIL_URL: _, ...noEmail } = DEV;
    expect(validateConfig("api", noEmail)).toEqual([]);
    expect(validateConfig("worker", noEmail)).toEqual([
      "EMAIL_URL is not set (copy .env.example to .env)",
    ]);
    const { AWS_MEDIA_BUCKET_NAME: __, ...noBucket } = DEV;
    expect(validateConfig("worker", noBucket)).toEqual([]);
  });

  it("checks formats", () => {
    expect(
      validateConfig("api", {
        ...DEV,
        PORT: "80a",
        SECRET_KEY: "short",
        PUBLIC_URL: "api.example.com",
        ALLOWED_GRAPHQL_ORIGINS: "http://localhost:5173, http://localhost:5173/path",
      }),
    ).toEqual([
      "SECRET_KEY must be at least 32 characters",
      "PORT must be a number",
      "PUBLIC_URL must be an absolute http(s) URL",
      'ALLOWED_GRAPHQL_ORIGINS: "http://localhost:5173/path" is not an origin (scheme://host[:port])',
    ]);
  });

  it("refuses dev defaults and missing settings in production", () => {
    const {
      ALLOWED_CLIENT_HOSTS: _,
      PUBLIC_URL: __,
      ALLOWED_GRAPHQL_ORIGINS: ___,
      ...rest
    } = PRODUCTION;
    expect(
      validateConfig("api", {
        ...rest,
        SECRET_KEY: DEV.SECRET_KEY,
        AWS_SECRET_ACCESS_KEY: DEV.AWS_SECRET_ACCESS_KEY,
      }),
    ).toEqual([
      "SECRET_KEY is the development value from .env.example",
      "ALLOWED_GRAPHQL_ORIGINS is not set (the dashboard's origin)",
      "ALLOWED_CLIENT_HOSTS is not set (hosts confirmation links may point to)",
      "PUBLIC_URL is not set (the API's public base URL, for thumbnail links)",
      "AWS_SECRET_ACCESS_KEY is the development value from .env.example",
    ]);
    expect(validateConfig("api", { ...PRODUCTION, ALLOWED_CLIENT_HOSTS: "a.com, *" })).toEqual([
      'ALLOWED_CLIENT_HOSTS must not contain "*" in production',
    ]);
  });
});
