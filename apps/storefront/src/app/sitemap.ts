import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { buildSitemapEntries } from "@/lib/seo/sitemap";
import { getSitemapLists } from "@/lib/seo/sitemap-data";

// ARCHITECTURE §10.14. Absolute URLs from STOREFRONT_URL only. If the API is down this throws and
// the response is a 5xx, never an empty sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The lists first: `connection()` inside keeps the build from reading runtime configuration.
  const lists = await getSitemapLists();
  return buildSitemapEntries(getEnv().storefrontUrl, lists);
}
