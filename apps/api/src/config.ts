import { readSecretKey } from "./modules/identity/index.ts";
import { readEmailConfig } from "./modules/jobs/index.ts";
import { readStorageConfig } from "./storage/index.ts";

// Startup configuration check (PLAN M9.1, decision 6). Each module keeps its own reader (they are
// what the code calls at runtime); this runs every reader a process needs once, at start, and
// collects all problems so a misconfigured deployment fails with one complete list instead of on
// the first request that happens to need a variable. `NODE_ENV=production` adds the rules that
// keep dev defaults out of production.

type Env = Record<string, string | undefined>;

/** Which process is starting: each needs a different set of variables. */
export type ProcessRole = "api" | "worker";

/** Values copied from .env.example (dev-only): refused in production. */
const DEV_SECRET_KEY = "dev-only-secret-change-me-0123456789abcdef";
const DEV_AWS_SECRET = "commerce-dev-secret";

const isProduction = (env: Env) => env.NODE_ENV === "production";

/** Runs `read`; its error message, if any, is added to `problems`. */
function check(problems: string[], read: () => unknown): void {
  try {
    read();
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
}

function requireSet(problems: string[], env: Env, name: string, why: string): void {
  if (!env[name]?.trim()) problems.push(`${name} is not set (${why})`);
}

function requireHttpUrl(problems: string[], env: Env, name: string): void {
  const value = env[name]?.trim();
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    problems.push(`${name} must be an absolute http(s) URL`);
  }
}

/** Every configuration problem for `role`; an empty list means the process can start. */
export function validateConfig(role: ProcessRole, env: Env = process.env): string[] {
  const problems: string[] = [];
  const production = isProduction(env);

  requireSet(problems, env, "DATABASE_URL", "copy .env.example to .env");
  // Tokens are made by the worker (emails) and checked by the API (confirmAccount).
  check(problems, () => readSecretKey(env));
  if (production && env.SECRET_KEY === DEV_SECRET_KEY) {
    problems.push("SECRET_KEY is the development value from .env.example");
  }

  if (role === "api") {
    const port = env.PORT;
    if (port !== undefined && !/^\d+$/.test(port)) problems.push("PORT must be a number");
    check(problems, () => readStorageConfig(env));
    requireHttpUrl(problems, env, "MEDIA_PUBLIC_URL");
    requireHttpUrl(problems, env, "PUBLIC_URL");
    for (const origin of (env.ALLOWED_GRAPHQL_ORIGINS ?? "").split(",")) {
      const trimmed = origin.trim();
      if (trimmed && !/^https?:\/\/[^/]+$/.test(trimmed)) {
        problems.push(
          `ALLOWED_GRAPHQL_ORIGINS: "${trimmed}" is not an origin (scheme://host[:port])`,
        );
      }
    }

    if (production) {
      // In dev these fall back to localhost values; in production a fallback is a bug.
      requireSet(problems, env, "ALLOWED_GRAPHQL_ORIGINS", "the dashboard's origin");
      requireSet(problems, env, "ALLOWED_CLIENT_HOSTS", "hosts confirmation links may point to");
      requireSet(problems, env, "PUBLIC_URL", "the API's public base URL, for thumbnail links");
      if ((env.ALLOWED_CLIENT_HOSTS ?? "").split(",").some((host) => host.trim() === "*")) {
        problems.push('ALLOWED_CLIENT_HOSTS must not contain "*" in production');
      }
      if (env.AWS_SECRET_ACCESS_KEY === DEV_AWS_SECRET) {
        problems.push("AWS_SECRET_ACCESS_KEY is the development value from .env.example");
      }
    }
  }

  if (role === "worker") {
    check(problems, () => readEmailConfig(env));
  }

  return problems;
}

/** Validates the environment for `role`; on any problem prints them all and exits. */
export function assertConfig(role: ProcessRole, env: Env = process.env): void {
  const problems = validateConfig(role, env);
  if (problems.length === 0) return;
  console.error(
    `Invalid configuration for the ${role}:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
