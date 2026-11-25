import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSitemapEntries, collectAll, type ListPage, SITEMAP_MAX_PAGES } from "./sitemap";

afterEach(() => vi.restoreAllMocks());

const page = (slugs: string[], next: string | null): ListPage => ({
  items: slugs.map((slug) => ({ slug })),
  hasNextPage: next !== null,
  endCursor: next,
});

describe("collectAll", () => {
  it("follows the cursor across pages until hasNextPage is false", async () => {
    const fetchPage = vi
      .fn<(after: string | null) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(["a", "b"], "c1"))
      .mockResolvedValueOnce(page(["c"], "c2"))
      .mockResolvedValueOnce(page(["d"], null));
    const items = await collectAll("products", fetchPage);
    expect(items.map((item) => item.slug)).toEqual(["a", "b", "c", "d"]);
    expect(fetchPage.mock.calls.map(([after]) => after)).toEqual([null, "c1", "c2"]);
  });

  it("stops at the page cap and logs a warning", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const fetchPage = vi.fn(async () => page(["x"], "more"));
    const items = await collectAll("products", fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(SITEMAP_MAX_PAGES);
    expect(items).toHaveLength(SITEMAP_MAX_PAGES);
    expect(String(write.mock.calls[0]?.[0])).toContain('"event":"sitemap.page_cap"');
  });

  it("throws when the API fails, so the sitemap is never short", async () => {
    const fetchPage = vi
      .fn<(after: string | null) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(["a"], "c1"))
      .mockRejectedValueOnce(new Error("API down"));
    await expect(collectAll("products", fetchPage)).rejects.toThrow("API down");
  });
});

describe("buildSitemapEntries", () => {
  it("lists home, the listing, then every type with absolute URLs", () => {
    const entries = buildSitemapEntries("https://shop.example", {
      products: [{ slug: "p1", updatedAt: "2026-01-02T03:04:05.000Z" }],
      categories: [{ slug: "c1" }],
      collections: [{ slug: "k1" }],
      pages: [{ slug: "terms" }],
    });
    expect(entries).toEqual([
      { url: "https://shop.example/" },
      { url: "https://shop.example/products" },
      { url: "https://shop.example/products/p1", lastModified: new Date("2026-01-02T03:04:05Z") },
      { url: "https://shop.example/categories/c1" },
      { url: "https://shop.example/collections/k1" },
      { url: "https://shop.example/pages/terms" },
    ]);
  });
});
