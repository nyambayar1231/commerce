import { describe, expect, it } from "vitest";
import { buildBreadcrumbJsonLd, buildProductJsonLd, serializeJsonLd } from "./json-ld";
import type { ProductView } from "./types";

// The product page's structured data (ARCHITECTURE §10.13): one Offer per variant with the
// deep-linked URL, availability from the stock state, absolute breadcrumb URLs — and the
// serializer that keeps catalog text from breaking out of the script element.

const inStockVariant: ProductView["variants"][number] = {
  id: "variant-1",
  name: "Улаан",
  sku: "NS-01",
  price: "₮\u00a025,000",
  priceAmount: 25000,
  stock: "lowStock",
  quantity: 3,
  mediaIds: ["media-1"],
};

const outOfStockVariant: ProductView["variants"][number] = {
  id: "variant-2",
  name: "Цагаан",
  sku: null,
  price: "₮\u00a0800,000",
  priceAmount: 800000,
  stock: "outOfStock",
  quantity: null,
  mediaIds: [],
};

const product: ProductView = {
  id: "UHJvZHVjdDox",
  name: 'Ноолуур шарф "<b>Монгол</b>"',
  slug: "nooluur-sharf",
  url: "/products/nooluur-sharf",
  description: [],
  descriptionText: "Маш дулаан, мөн зөөлөн.",
  breadcrumbs: [{ name: "Ноолуур", href: "/categories/nooluur" }],
  images: [
    {
      id: "media-1",
      alt: "Ноолуур шарф",
      thumb: "https://img/128.webp",
      src: "https://img/1024.webp",
      srcSet: "https://img/1024.webp 1024w, https://img/2048.webp 2048w",
      large: "https://img/2048.webp",
    },
  ],
  variants: [inStockVariant, outOfStockVariant],
  priceRange: { min: "₮\u00a025,000", max: "₮\u00a0800,000" },
};

const BASE = "https://dino-craft.lol";

describe("buildProductJsonLd", () => {
  it("names the product, its description text and its image URLs", () => {
    const jsonLd = buildProductJsonLd(product, BASE);
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe(product.name);
    expect(jsonLd.description).toBe("Маш дулаан, мөн зөөлөн.");
    expect(jsonLd.image).toEqual(["https://img/1024.webp"]);
  });

  it("falls back to the name when there is no description text", () => {
    expect(buildProductJsonLd({ ...product, descriptionText: "" }, BASE).description).toBe(
      product.name,
    );
  });

  it("carries the sku only when the product has exactly one variant", () => {
    expect(buildProductJsonLd(product, BASE).sku).toBeUndefined();
    const single = buildProductJsonLd({ ...product, variants: [inStockVariant] }, BASE);
    expect(single.sku).toBe("NS-01");
    const unskuued = buildProductJsonLd(
      { ...product, variants: [{ ...inStockVariant, sku: null }] },
      BASE,
    );
    expect(unskuued.sku).toBeUndefined();
  });

  it("offers one Offer per variant: deep-linked URL, MNT, a plain price, availability", () => {
    const jsonLd = buildProductJsonLd(product, BASE);
    expect(jsonLd.offers).toEqual([
      {
        "@type": "Offer",
        url: "https://dino-craft.lol/products/nooluur-sharf?variant=variant-1",
        priceCurrency: "MNT",
        price: "25000",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        url: "https://dino-craft.lol/products/nooluur-sharf?variant=variant-2",
        priceCurrency: "MNT",
        price: "800000",
        availability: "https://schema.org/OutOfStock",
      },
    ]);
  });

  it("keeps a low-stock variant buyable: InStock, not OutOfStock", () => {
    expect(buildProductJsonLd(product, BASE).offers[0]?.availability).toBe(
      "https://schema.org/InStock",
    );
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("lists every crumb with an absolute URL, positions from 1", () => {
    const jsonLd = buildBreadcrumbJsonLd(
      [
        { name: "Нүүр хуудас", href: "/" },
        ...product.breadcrumbs,
        { name: product.name, href: product.url },
      ],
      BASE,
    );
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Нүүр хуудас", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: "Ноолуур", item: `${BASE}/categories/nooluur` },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${BASE}/products/nooluur-sharf`,
      },
    ]);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < > and & so catalog text cannot break out of the script element", () => {
    const hostile = { name: "</script><script>alert('&x')</script>" };
    const serialized = serializeJsonLd(hostile);
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    // The escapes are the JSON-safe \u forms, so the payload still parses back exactly.
    expect(serialized).toBe(
      '{"name":"\\u003C/script\\u003E\\u003Cscript\\u003Ealert(\'\\u0026x\')\\u003C/script\\u003E"}',
    );
    expect(JSON.parse(serialized)).toEqual(hostile);
  });

  it("round-trips ordinary data unchanged", () => {
    const data = buildProductJsonLd(product, BASE);
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
