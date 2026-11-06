import { defineConfig } from "vitest/config";

// Local runs read DATABASE_URL_TEST from the repo-root .env; CI sets it as a real env var.
try {
  process.loadEnvFile("../../.env");
} catch {
  // no .env file
}

const testUrl = process.env.DATABASE_URL_TEST ?? "";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // All files share one database, so they run one after another.
    fileParallelism: false,
    // Point @commerce/db's getDb() at the test database through the same variable production
    // reads. Code under test needs no test-only wiring.
    env: { DATABASE_URL: testUrl },
  },
});
