import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getEnv } from "@/lib/env";
import { buildRobots } from "@/lib/seo/robots";

// `connection()` first: STOREFRONT_URL is runtime configuration (§10.13), so this is answered per
// request, never prerendered into the image at build time.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return buildRobots(getEnv().storefrontUrl);
}
