import type { ProductView } from "./types";

// The product page's structured data (ARCHITECTURE §10.13, §10.14): a schema.org `Product` with
// one `Offer` per variant and a `BreadcrumbList`, both with absolute URLs from `STOREFRONT_URL`.
// Pure and unit-tested: the page passes the base URL in, the serializer here makes the payload
// safe for an inline `<script>` tag.

const SCHEMA = "https://schema.org";
export const IN_STOCK = `${SCHEMA}/InStock`;
export const OUT_OF_STOCK = `${SCHEMA}/OutOfStock`;

/** The shop's currency: one channel, one currency (ADR-0005, ADR-0013). */
export const SHOP_CURRENCY = "MNT";

export type ProductJsonLd = {
  "@context": string;
  "@type": "Product";
  name: string;
  description: string;
  image?: string[];
  sku?: string;
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: string;
    price: string;
    availability: string;
  }[];
};

export type BreadcrumbItem = { name: string; href: string };

export type BreadcrumbListJsonLd = {
  "@context": string;
  "@type": "BreadcrumbList";
  itemListElement: {
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }[];
};

/** `availability` of one offer: `lowStock` still means it can be bought (§10.3's advisor rule). */
function availability(stock: ProductView["variants"][number]["stock"]): string {
  return stock === "outOfStock" ? OUT_OF_STOCK : IN_STOCK;
}

/**
 * The page's `Product` structured data: name, description text, image URLs, the sku when the
 * product has exactly one variant, and one `Offer` per variant — its price as a plain number
 * string, the shop's currency, its availability, and its deep link with `?variant=`.
 */
export function buildProductJsonLd(product: ProductView, baseUrl: string): ProductJsonLd {
  const jsonLd: ProductJsonLd = {
    "@context": SCHEMA,
    "@type": "Product",
    name: product.name,
    description: product.descriptionText === "" ? product.name : product.descriptionText,
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      url: `${baseUrl}${product.url}?variant=${variant.id}`,
      priceCurrency: SHOP_CURRENCY,
      price: String(variant.priceAmount),
      availability: availability(variant.stock),
    })),
  };
  if (product.images.length > 0) jsonLd.image = product.images.map((image) => image.src);
  const single = product.variants.length === 1 ? product.variants[0] : undefined;
  if (single !== undefined && single.sku !== null) jsonLd.sku = single.sku;
  return jsonLd;
}

/** The breadcrumb trail as a `BreadcrumbList`: every item an absolute URL, positions from 1. */
export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  baseUrl: string,
): BreadcrumbListJsonLd {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.href}`,
    })),
  };
}

// Characters that are significant to the HTML parser inside a `<script>` element: JSON.stringify
// escapes quotes and backslashes but not these (the Next.js JSON-LD guide's `</script>` breakout).
const UNSAFE: Record<string, string> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "&": "\\u0026",
};

/**
 * Serializes structured data for `<script type="application/ld+json">`: `JSON.stringify` with
 * `<`, `>` and `&` escaped as their `\u` forms, so catalog text such as a product name of
 * `</script><script>` can never break out of the script element. `JSON.parse` still reads the
 * result back exactly.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/[<>&]/g, (char) => UNSAFE[char] ?? char);
}
