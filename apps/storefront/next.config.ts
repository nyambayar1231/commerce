import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { cacheProfiles } from "./src/lib/api/cache-profiles.ts";

// The repository's single .env (like the API and the worker), loaded before anything reads it.
const repoRoot = path.resolve(import.meta.dirname, "../..");
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: cacheProfiles,
  partialPrefetching: true,
  agentRules: false, // `next dev` would otherwise write an AGENTS.md into the app
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@commerce/contracts"],
  poweredByHeader: false,
  // Images come from the API's stored thumbnails, never the Next.js optimizer (ARCHITECTURE §10.12).
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
