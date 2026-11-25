import type { Money } from "@commerce/contracts";
import { CURRENCIES } from "@commerce/contracts";
import type { ProductDetailsQuery } from "@/gql/graphql";
import { parseRichText, richTextToPlainText } from "@/lib/content/rich-text";
import { formatMoney } from "@/lib/format";
import { toMoney } from "@/lib/money";
import type { ProductView, VariantStock, VariantView } from "./types";

// The product page's mapper (ARCHITECTURE §10.3): generated GraphQL in, a `ProductView` out —
// money formatted here on the server (§10.11), stock reduced to the buy box's three states,
// media as the gallery's image rungs, and the category trail as breadcrumbs.

type ProductDetailsNode = NonNullable<ProductDetailsQuery["product"]>;
type VariantNode = ProductDetailsNode["variants"][number];

/** The low-stock threshold: at or below this many units the buy box says how many are left. */
export const LOW_STOCK_MAX = 5;

/** `quantityAvailable` (available = quantity − allocated) as the buy box's stock state. */
export function toStockState(quantityAvailable: number | null): {
  stock: VariantStock;
  quantity: number | null;
} {
  // `null` means the variant's stock is not tracked: it counts as available.
  if (quantityAvailable === null) return { stock: "inStock", quantity: null };
  if (quantityAvailable === 0) return { stock: "outOfStock", quantity: null };
  if (quantityAvailable <= LOW_STOCK_MAX) return { stock: "lowStock", quantity: quantityAvailable };
  return { stock: "inStock", quantity: null };
}

function toVariant(variant: VariantNode): VariantView {
  const money = toMoney(variant.price);
  const { stock, quantity } = toStockState(variant.quantityAvailable);
  return {
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    price: formatMoney(money),
    // JSON-LD wants the price in major units, not the minor-integer `Money`.
    priceAmount: money.amountMinor / 10 ** CURRENCIES[money.currency].exponent,
    stock,
    quantity,
    mediaIds: variant.media.map((media) => media.id),
  };
}

/** The lowest and highest variant price, formatted; `max` is null when every price is equal. */
export function toPriceRange(prices: Money[]): ProductView["priceRange"] {
  let low: Money | undefined;
  let high: Money | undefined;
  for (const price of prices) {
    if (low === undefined || price.amountMinor < low.amountMinor) low = price;
    if (high === undefined || price.amountMinor > high.amountMinor) high = price;
  }
  if (low === undefined || high === undefined) return { min: "", max: null };
  return {
    min: formatMoney(low),
    max: low.amountMinor === high.amountMinor ? null : formatMoney(high),
  };
}

/** A product page's data, from the `ProductDetails` query. */
export function toProduct(node: ProductDetailsNode): ProductView {
  const images = node.media
    .filter((media) => media.type === "IMAGE")
    .map((media) => {
      // An empty alt text falls back to the product name (§10.12).
      const alt = media.alt.trim();
      return {
        id: media.id,
        alt: alt === "" ? node.name : alt,
        thumb: media.thumb,
        src: media.medium,
        srcSet: `${media.medium} 1024w, ${media.large} 2048w`,
        large: media.large,
      };
    });

  // The API lists the ancestors root first, without the category itself (Saleor's MPTT
  // `get_ancestors()`); the trail ends with the product's own category.
  const breadcrumbs =
    node.category === null
      ? []
      : [
          ...(node.category.ancestors?.edges ?? []).map((edge) => ({
            name: edge.node.name,
            href: `/categories/${edge.node.slug}`,
          })),
          { name: node.category.name, href: `/categories/${node.category.slug}` },
        ];

  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    url: `/products/${node.slug}`,
    description: parseRichText(node.description),
    descriptionText: richTextToPlainText(node.description),
    breadcrumbs,
    images,
    variants: node.variants.map(toVariant),
    priceRange: toPriceRange(node.variants.map((variant) => toMoney(variant.price))),
  };
}
