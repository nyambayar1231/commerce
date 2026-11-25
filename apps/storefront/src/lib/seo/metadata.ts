import type { Metadata } from "next";

// Shared metadata pieces (ARCHITECTURE §10.14). Next replaces `openGraph` as a whole when a route
// sets it, so every route that sets one spreads `openGraphFor` to keep the shop-wide defaults.

export const OG_LOCALE = "mn_MN";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** The default Open Graph block of the root layout. */
export function defaultOpenGraph(siteName: string): OpenGraph {
  return { type: "website", locale: OG_LOCALE, siteName };
}

/** The defaults plus a route's own fields (for example the product's image). */
export function openGraphFor(siteName: string, extra: Partial<OpenGraph> = {}): OpenGraph {
  return { ...defaultOpenGraph(siteName), ...extra } as OpenGraph;
}
