import type { MetadataRoute } from "next";
import { log } from "@/lib/log";

// The sitemap's pure parts (ARCHITECTURE §10.14): paging through a list and building the URLs.
// The cached API reads live in `sitemap-data.ts`.

/** The API's largest page (`first` is at most 100). */
export const SITEMAP_PAGE_SIZE = 100;
/** A hard stop per list: 50 pages x 100 = 5000 URLs per type. */
export const SITEMAP_MAX_PAGES = 50;

export type SitemapItem = { slug: string; updatedAt?: string };
export type ListPage = { items: SitemapItem[]; hasNextPage: boolean; endCursor: string | null };
export type SitemapLists = {
  products: SitemapItem[];
  categories: SitemapItem[];
  collections: SitemapItem[];
  pages: SitemapItem[];
};

/**
 * Every item of one list: pages of `SITEMAP_PAGE_SIZE` until `hasNextPage` is false. A failing
 * `fetchPage` throws, so the sitemap fails (5xx) and is never served short.
 */
export async function collectAll(
  type: string,
  fetchPage: (after: string | null) => Promise<ListPage>,
  maxPages = SITEMAP_MAX_PAGES,
): Promise<SitemapItem[]> {
  const items: SitemapItem[] = [];
  let after: string | null = null;
  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchPage(after);
    items.push(...result.items);
    if (!result.hasNextPage || result.endCursor === null) return items;
    after = result.endCursor;
  }
  log.warn("sitemap.page_cap", { type, maxPages, items: items.length });
  return items;
}

/** The sitemap's entries: home, the listing, then products, categories, collections, pages. */
export function buildSitemapEntries(baseUrl: string, lists: SitemapLists): MetadataRoute.Sitemap {
  const entries = (prefix: string, items: SitemapItem[]): MetadataRoute.Sitemap =>
    items.map((item) => ({
      url: `${baseUrl}${prefix}/${item.slug}`,
      ...(item.updatedAt === undefined ? {} : { lastModified: new Date(item.updatedAt) }),
    }));
  return [
    { url: `${baseUrl}/` },
    { url: `${baseUrl}/products` },
    ...entries("/products", lists.products),
    ...entries("/categories", lists.categories),
    ...entries("/collections", lists.collections),
    ...entries("/pages", lists.pages),
  ];
}
