import { defineConfig } from "drizzle-kit";

// drizzle-kit runs as its own process from packages/db, so it loads the repo-root .env itself.
// (In CI/production DATABASE_URL comes from the real environment.)
try {
  process.loadEnvFile("../../.env");
} catch {
  // no .env file
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
