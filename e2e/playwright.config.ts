import { defineConfig, devices } from "@playwright/test";
import { API_PORT, API_URL, DASHBOARD_PORT, DASHBOARD_URL, e2eDatabaseUrl } from "./env.ts";

// Golden paths (PLAN M9.7): the real API and the dashboard's dev server on their own ports, against
// a fresh commerce_e2e database (prepare.ts). `pnpm e2e` from the root; needs `pnpm db:up` and, once,
// `pnpm --filter @commerce/e2e e2e:install` for the browser.
export default defineConfig({
  testDir: "tests",
  // One shared database: the tests build on each other's data and run in order.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: DASHBOARD_URL,
    // Saleor's attribute name, which the dashboard keeps (getByTestId reads it).
    testIdAttribute: "data-test-id",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "node prepare.ts && node --env-file-if-exists=../.env ../apps/api/src/server.ts",
      url: `http://localhost:${API_PORT}/health/ready`,
      env: {
        DATABASE_URL: e2eDatabaseUrl(),
        PORT: String(API_PORT),
        ALLOWED_GRAPHQL_ORIGINS: DASHBOARD_URL,
        PUBLIC_URL: `http://localhost:${API_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @commerce/dashboard exec vite --port ${DASHBOARD_PORT} --strictPort`,
      url: DASHBOARD_URL,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
