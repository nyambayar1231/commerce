import { mnt } from "@commerce/contracts";
import { describe, expect, it } from "vitest";
import type { ProductDetailsQuery } from "@/gql/graphql";
import { toPriceRange, toProduct, toStockState } from "./product-mappers";

// The product mapper (ARCHITECTURE §10.3): generated GraphQL in, the page's view model out —
// stock thresholds, the price range, the breadcrumb trail's order, the alt fallback and the
// image rungs.

type ProductNode = NonNullable<ProductDetailsQuery["product"]>;

function productNode(overrides: Partial<ProductNode> = {}): ProductNode {
  return {
    id: "UHJvZHVjdDox",
    name: "Ноолуур шарф",
    slug: "nooluur-sharf",
    description: null,
    updatedAt: "2026-11-24T10:00:00.000Z",
    category: null,
    media: [],
    variants: [],
    ...overrides,
  };
}

describe("toStockState", () => {
  it("treats untracked stock as available", () => {
    expect(toStockState(null)).toEqual({ stock: "inStock", quantity: null });
  });

  it("marks zero unavailable, without a quantity", () => {
    expect(toStockState(0)).toEqual({ stock: "outOfStock", quantity: null });
  });

  it("marks 1 to 5 units low, with the quantity", () => {
    expect(toStockState(1)).toEqual({ stock: "lowStock", quantity: 1 });
    expect(toStockState(5)).toEqual({ stock: "lowStock", quantity: 5 });
  });

  it("treats more than 5 units as available", () => {
    expect(toStockState(6)).toEqual({ stock: "inStock", quantity: null });
  });
});

describe("toPriceRange", () => {
  it("has no max when every price is equal", () => {
    expect(toPriceRange([mnt(25000), mnt(25000)])).toEqual({
      min: "₮\u00a025,000",
      max: null,
    });
  });

  it("takes the lowest and highest variant price", () => {
    expect(toPriceRange([mnt(800000), mnt(30000), mnt(50000)])).toEqual({
      min: "₮\u00a030,000",
      max: "₮\u00a0800,000",
    });
  });

  it("is empty without variants", () => {
    expect(toPriceRange([])).toEqual({ min: "", max: null });
  });
});

describe("toProduct", () => {
  it("maps the identity fields, the canonical path and the description", () => {
    const view = toProduct(
      productNode({
        description: JSON.stringify({
          blocks: [{ type: "paragraph", data: { text: "Маш дулаан шарф." } }],
        }),
      }),
    );
    expect(view.url).toBe("/products/nooluur-sharf");
    expect(view.description).toEqual([{ type: "paragraph", html: "Маш дулаан шарф." }]);
    expect(view.descriptionText).toBe("Маш дулаан шарф.");
  });

  it("builds the breadcrumb trail: ancestors root first, then the category", () => {
    const view = toProduct(
      productNode({
        category: {
          name: "Ороолт",
          slug: "oroolt",
          ancestors: {
            edges: [
              { node: { name: "Ноолуур", slug: "nooluur" } },
              { node: { name: "Хувцас", slug: "khuvtsas" } },
            ],
          },
        },
      }),
    );
    expect(view.breadcrumbs).toEqual([
      { name: "Ноолуур", href: "/categories/nooluur" },
      { name: "Хувцас", href: "/categories/khuvtsas" },
      { name: "Ороолт", href: "/categories/oroolt" },
    ]);
  });

  it("has an empty trail without a category", () => {
    expect(toProduct(productNode()).breadcrumbs).toEqual([]);
  });

  it("falls back to the product name for an empty alt, keeps a real one", () => {
    const view = toProduct(
      productNode({
        media: [
          {
            id: "media-1",
            alt: "  ",
            type: "IMAGE",
            thumb: "https://img/128.webp",
            medium: "https://img/1024.webp",
            large: "https://img/2048.webp",
          },
          {
            id: "media-2",
            alt: "Цагаан шарф",
            type: "IMAGE",
            thumb: "https://img/2-128.webp",
            medium: "https://img/2-1024.webp",
            large: "https://img/2-2048.webp",
          },
        ],
      }),
    );
    expect(view.images).toHaveLength(2);
    expect(view.images[0]?.alt).toBe("Ноолуур шарф");
    expect(view.images[1]?.alt).toBe("Цагаан шарф");
  });

  it("composes each image's srcSet from the 1024 and 2048 rungs", () => {
    const view = toProduct(
      productNode({
        media: [
          {
            id: "media-1",
            alt: "",
            type: "IMAGE",
            thumb: "https://img/128.webp",
            medium: "https://img/1024.webp",
            large: "https://img/2048.webp",
          },
        ],
      }),
    );
    expect(view.images[0]).toMatchObject({
      id: "media-1",
      thumb: "https://img/128.webp",
      src: "https://img/1024.webp",
      large: "https://img/2048.webp",
      srcSet: "https://img/1024.webp 1024w, https://img/2048.webp 2048w",
    });
  });

  it("keeps only image media", () => {
    const view = toProduct(
      productNode({
        media: [
          {
            id: "video-1",
            alt: "",
            type: "VIDEO",
            thumb: "https://img/128.webp",
            medium: "https://img/1024.webp",
            large: "https://img/2048.webp",
          },
        ],
      }),
    );
    expect(view.images).toEqual([]);
  });

  it("maps the variants: price formatted, amount for JSON-LD, stock, media ids", () => {
    const view = toProduct(
      productNode({
        variants: [
          {
            id: "variant-1",
            name: "Улаан",
            sku: "NS-01",
            price: { amount: 25000, currency: "MNT" },
            quantityAvailable: 3,
            media: [{ id: "media-1" }],
          },
          {
            id: "variant-2",
            name: "Цагаан",
            sku: null,
            price: { amount: 800000, currency: "MNT" },
            quantityAvailable: null,
            media: [],
          },
        ],
      }),
    );
    expect(view.variants).toEqual([
      {
        id: "variant-1",
        name: "Улаан",
        sku: "NS-01",
        price: "₮\u00a025,000",
        priceAmount: 25000,
        stock: "lowStock",
        quantity: 3,
        mediaIds: ["media-1"],
      },
      {
        id: "variant-2",
        name: "Цагаан",
        sku: null,
        price: "₮\u00a0800,000",
        priceAmount: 800000,
        stock: "inStock",
        quantity: null,
        mediaIds: [],
      },
    ]);
    expect(view.priceRange).toEqual({ min: "₮\u00a025,000", max: "₮\u00a0800,000" });
  });
});
