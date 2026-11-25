import type { MetadataRoute } from "next";

// Private routes crawlers stay out of (ARCHITECTURE §10.14); the same routes are `noindex` too.
export const DISALLOWED_PATHS = [
  "/cart",
  "/checkout",
  "/account",
  "/order/",
  "/search",
  "/api/",
  "/login",
  "/signup",
  "/reset-password",
  "/set-password",
  "/confirm-account",
];

export function buildRobots(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
