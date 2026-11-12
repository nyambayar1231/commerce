// Shared by playwright.config.ts, prepare.ts and the tests (PLAN M9.7). Their own ports and their
// own database, so the golden paths run next to the dev servers without touching their data.

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // CI sets the variables directly.
}

export const API_PORT = 4010;
export const DASHBOARD_PORT = 5183;
export const API_URL = `http://localhost:${API_PORT}/graphql`;
export const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;

/** The dev database's server, with the database name swapped for commerce_e2e. */
export function e2eDatabaseUrl(): string {
  if (process.env.DATABASE_URL_E2E) return process.env.DATABASE_URL_E2E;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
  const url = new URL(base);
  url.pathname = "/commerce_e2e";
  return url.toString();
}

// The staff account prepare.ts creates; test-only values for the e2e database.
export const STAFF_EMAIL = "e2e-staff@example.com";
export const STAFF_PASSWORD = "e2e-staff-password-0123";
