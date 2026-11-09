import { defineConfig } from "vitest/config";

// Local runs read DATABASE_URL_TEST from the repo-root .env; CI sets it as a real env var.
try {
  process.loadEnvFile("../../.env");
} catch {
  // no .env file
}

const testUrl = process.env.DATABASE_URL_TEST ?? "";

export default defineConfig({
  // Resolve packages as Node does. graphql 17 ships a CommonJS and an ESM build; Node imports the
  // ESM one through the `module-sync` condition, which Vite doesn't apply by default, so our source
  // got the CommonJS build while Yoga (loaded by Node) got the ESM one: two GraphQLError classes,
  // and Yoga masked every GraphQLError we throw (e.g. PermissionDenied) as "Unexpected error.".
  ssr: { resolve: { conditions: ["module-sync", "node", "import", "default"] } },
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // All files share one database, so they run one after another.
    fileParallelism: false,
    // Point @commerce/db's getDb() at the test database through the same variable production
    // reads. Code under test needs no test-only wiring.
    env: { DATABASE_URL: testUrl },
  },
});
