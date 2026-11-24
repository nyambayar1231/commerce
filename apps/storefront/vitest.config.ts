import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside Next's server bundles; tests run plain Node.
      "server-only": path.resolve(import.meta.dirname, "src/test/serverOnlyStub.ts"),
    },
  },
  // Component tests opt into jsdom per file with `// @vitest-environment jsdom`.
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
});
