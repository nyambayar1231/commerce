import { describe, expect, it } from "vitest";
import type { FilterOptionsQuery, ProductCardFragment, ProductListingQuery } from "@/gql/graphql";
import { toFilterOptions, toListing, toProductCard } from "./mappers";

// The card mapper (ARCHITECTURE §10.3): generated GraphQL in, view models out, money formatted
// on the server. Tracked and untracked variants, price ranges, images and their fallbacks.

function cardNode(overrides: Partial<ProductCardFragment> = {}): ProductCardFragment {
  return {
    id: "UHJvZHVjdDox",
    name: "Ноолуур шарф",
    slug: "nooluur-sharf",
    category: null,
    small: null,
    large: null,
    minimalVariantPrice: null,
    variants: [],
    ...overrides,
  };
}

describe("toProductCard", () => {
  it("maps the names, link and category", () => {
    const card = toProductCard(
      cardNode({
        category: { name: "Гоо сайхан" },
        minimalVariantPrice: { amount: 25000, currency: "MNT" },
      }),
    );
    expect(card).toMatchObject({
      id: "UHJvZHVjdDox",
      name: "Ноолуур шарф",
      href: "/products/nooluur-sharf",
      categoryName: "Гоо сайхан",
      price: "₮\u00a025,000",
    });
  });

  it("has no price when the product has no variant price", () => {
    expect(toProductCard(cardNode()).price).toBeNull();
    expect(toProductCard(cardNode()).priceFrom).toBe(false);
  });

  it("marks a starting price when the variants' prices differ", () => {
    const same = cardNode({
      minimalVariantPrice: { amount: 1000, currency: "MNT" },
      variants: [
        { id: "v1", price: { amount: 1000 }, quantityAvailable: 5 },
        { id: "v2", price: { amount: 1000 }, quantityAvailable: 5 },
      ],
    });
    const differ = cardNode({
      minimalVariantPrice: { amount: 1000, currency: "MNT" },
      variants: [
        { id: "v1", price: { amount: 1000 }, quantityAvailable: 5 },
        { id: "v2", price: { amount: 2000 }, quantityAvailable: 5 },
      ],
    });
    expect(toProductCard(same).priceFrom).toBe(false);
    expect(toProductCard(differ).priceFrom).toBe(true);
  });

  it("is sold out only when every variant is tracked and empty", () => {
    const soldOut = cardNode({
      minimalVariantPrice: { amount: 1000, currency: "MNT" },
      variants: [
        { id: "v1", price: { amount: 1000 }, quantityAvailable: 0 },
        { id: "v2", price: { amount: 2000 }, quantityAvailable: 0 },
      ],
    });
    expect(toProductCard(soldOut).soldOut).toBe(true);

    // A null quantity means the stock is not tracked, so the variant is available.
    const untracked = cardNode({
      minimalVariantPrice: { amount: 1000, currency: "MNT" },
      variants: [{ id: "v1", price: { amount: 1000 }, quantityAvailable: null }],
    });
    expect(toProductCard(untracked).soldOut).toBe(false);

    const partlyInStock = cardNode({
      minimalVariantPrice: { amount: 1000, currency: "MNT" },
      variants: [
        { id: "v1", price: { amount: 1000 }, quantityAvailable: 0 },
        { id: "v2", price: { amount: 2000 }, quantityAvailable: 3 },
      ],
    });
    expect(toProductCard(partlyInStock).soldOut).toBe(false);

    expect(toProductCard(cardNode()).soldOut).toBe(false);
  });

  it("offers quick add only for a single variant that is not sold out", () => {
    const one = (quantityAvailable: number | null) =>
      cardNode({ variants: [{ id: "v1", price: { amount: 1000 }, quantityAvailable }] });
    expect(toProductCard(one(5)).quickAddVariantId).toBe("v1");
    // Untracked stock (null) is available.
    expect(toProductCard(one(null)).quickAddVariantId).toBe("v1");
    expect(toProductCard(one(0)).quickAddVariantId).toBeNull();
    // Several variants: the shopper chooses on the product page.
    const several = cardNode({
      variants: [
        { id: "v1", price: { amount: 1000 }, quantityAvailable: 5 },
        { id: "v2", price: { amount: 1000 }, quantityAvailable: 5 },
      ],
    });
    expect(toProductCard(several).quickAddVariantId).toBeNull();
    expect(toProductCard(cardNode()).quickAddVariantId).toBeNull();
  });

  it("builds the image srcSet from the two thumbnails and falls back to the name for alt", () => {
    const card = toProductCard(
      cardNode({
        small: { url: "https://img/256.webp", alt: null },
        large: { url: "https://img/512.webp" },
      }),
    );
    expect(card.image).toEqual({
      src: "https://img/256.webp",
      srcSet: "https://img/256.webp 256w, https://img/512.webp 512w",
      alt: "Ноолуур шарф",
    });
  });

  it("keeps the media's alt text", () => {
    const card = toProductCard(
      cardNode({ small: { url: "https://img/256.webp", alt: "Цагаан шарф" } }),
    );
    expect(card.image?.alt).toBe("Цагаан шарф");
  });

  it("has no image without a thumbnail", () => {
    expect(toProductCard(cardNode({ large: { url: "https://img/512.webp" } })).image).toBeNull();
  });
});

describe("toListing", () => {
  it("maps the connection: cards, the total, the cursor window", () => {
    const products = {
      totalCount: 30,
      edges: [
        { cursor: "c1", node: cardNode({ id: "p1" }) },
        { cursor: "c2", node: cardNode({ id: "p2" }) },
      ],
      pageInfo: {
        hasNextPage: true,
        hasPreviousPage: false,
        startCursor: "c1",
        endCursor: "c2",
      },
    } as unknown as NonNullable<ProductListingQuery["products"]>;
    const listing = toListing(products);
    expect(listing.items).toHaveLength(2);
    expect(listing.items[1]?.id).toBe("p2");
    expect(listing.totalCount).toBe(30);
    expect(listing.pageInfo).toEqual({
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: "c1",
      endCursor: "c2",
    });
  });
});

describe("toFilterOptions", () => {
  it("flattens the two option lists", () => {
    const data = {
      categories: {
        edges: [
          { node: { name: "Гэр ахуй", slug: "ger-akhui", level: 0 } },
          { node: { name: "Гутал", slug: "gutal", level: 0 } },
        ],
      },
      collections: { edges: [{ node: { name: "Шинэ бараа", slug: "shine-baraa" } }] },
    } as unknown as FilterOptionsQuery;
    expect(toFilterOptions(data)).toEqual({
      categories: [
        { name: "Гэр ахуй", slug: "ger-akhui", level: 0 },
        { name: "Гутал", slug: "gutal", level: 0 },
      ],
      collections: [{ name: "Шинэ бараа", slug: "shine-baraa" }],
    });
  });
});
