import type { CartFragment } from "@/gql/graphql";
import { formatMoney } from "@/lib/format";
import { toMoney } from "@/lib/money";
import type { CartLineView, CartView } from "./types";

// Generated GraphQL in, view models out; the one place cart money becomes a formatted string
// on the server (ARCHITECTURE §10.11).

const THUMBNAIL_SIZE = 256;

function toLine(line: CartFragment["lines"][number]): CartLineView {
  const { variant } = line;
  const thumbnail = variant.product.thumbnail;
  return {
    id: line.id,
    productName: variant.product.name,
    variantName: variant.name,
    href: `/products/${variant.product.slug}?variant=${encodeURIComponent(variant.id)}`,
    image:
      thumbnail === null || thumbnail === undefined
        ? null
        : {
            src: thumbnail.url,
            srcSet: `${thumbnail.url} ${THUMBNAIL_SIZE}w`,
            alt: thumbnail.alt ?? variant.product.name,
          },
    quantity: line.quantity,
    maxQuantity: variant.quantityAvailable ?? null,
    unitPrice: formatMoney(toMoney(line.unitPrice.gross)),
    totalPrice: formatMoney(toMoney(line.totalPrice.gross)),
  };
}

export function toCartView(checkout: CartFragment): CartView {
  return {
    token: checkout.token,
    quantity: checkout.lines.reduce((sum, line) => sum + line.quantity, 0),
    lines: checkout.lines.map(toLine),
    subtotal: formatMoney(toMoney(checkout.subtotalPrice.gross)),
  };
}
