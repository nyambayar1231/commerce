import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));
const cachedQuery = vi.fn();
vi.mock("@/lib/api", () => ({
  cachedQuery: (...args: unknown[]) => cachedQuery(...args),
  tags: {
    products: "products",
    collection: (slug: string) => `collection:${slug}`,
  },
}));

const { getFeaturedCollection, getHomeCategories, FEATURED_COLLECTION_SLUG } = await import(
  "./home"
);

// The home islands' hiding rules: the featured section is null while the `featured-products`
// collection is missing or empty; the tiles are just the top-level categories.

function cardNode(id: string, name: string) {
  return {
    id,
    name,
    slug: `slug-${id}`,
    category: null,
    small: null,
    large: null,
    minimalVariantPrice: { amount: 1000, currency: "MNT" },
    variants: [],
  };
}

beforeEach(() => {
  cachedQuery.mockReset();
});

describe("getFeaturedCollection", () => {
  it("is null while the collection doesn't exist", async () => {
    cachedQuery.mockResolvedValue({ collection: null });
    expect(await getFeaturedCollection()).toBeNull();
    expect(cachedQuery).toHaveBeenCalledWith(expect.anything(), {
      variables: { slug: FEATURED_COLLECTION_SLUG },
      tags: [`collection:${FEATURED_COLLECTION_SLUG}`, "products"],
    });
  });

  it("is null when the collection has no products", async () => {
    cachedQuery.mockResolvedValue({
      collection: { name: "Онцлох", products: { edges: [] } },
    });
    expect(await getFeaturedCollection()).toBeNull();
  });

  it("maps the collection's products as cards", async () => {
    cachedQuery.mockResolvedValue({
      collection: { name: "Онцлох", products: { edges: [{ node: cardNode("p1", "Шарф") }] } },
    });
    const featured = await getFeaturedCollection();
    expect(featured).toEqual({
      name: "Онцлох",
      items: [expect.objectContaining({ id: "p1", name: "Шарф", href: "/products/slug-p1" })],
    });
  });
});

describe("getHomeCategories", () => {
  it("lists the top-level categories and survives a null connection", async () => {
    cachedQuery.mockResolvedValue({
      categories: { edges: [{ node: { name: "Гоо сайхан", slug: "goo-saihan" } }] },
    });
    expect(await getHomeCategories()).toEqual([{ name: "Гоо сайхан", slug: "goo-saihan" }]);

    cachedQuery.mockResolvedValue({ categories: null });
    expect(await getHomeCategories()).toEqual([]);
  });
});
