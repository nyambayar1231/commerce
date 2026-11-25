// View models and action states of the cart (ARCHITECTURE §10.9). `src/ui/**` imports these types
// (and only these from `src/lib`); `mappers.ts` turns generated GraphQL into them, so money
// reaches the UI already formatted.

import type { ProductCardImage } from "@/lib/catalog/types";

/** Keys of the `cart.errors` message namespace. */
export type CartErrorKey =
  | "insufficientStock"
  | "quantityLimit"
  | "notAvailable"
  | "invalidQuantity"
  | "unavailable"
  | "generic";

/** What a cart Server Action returns; the UI shows `message` in an `aria-live` region. */
export type CartActionState = {
  status: "idle" | "success" | "error";
  message?: CartErrorKey;
};

export type CartLineView = {
  /** The API's checkout line id (global). */
  id: string;
  productName: string;
  variantName: string;
  /** The product page with the line's variant selected. */
  href: string;
  image: ProductCardImage | null;
  quantity: number;
  /** What is available to buy (`quantityAvailable`); null when stock is not tracked. */
  maxQuantity: number | null;
  unitPrice: string;
  totalPrice: string;
};

export type CartView = {
  token: string;
  /** The number of items (the sum of the line quantities). */
  quantity: number;
  lines: CartLineView[];
  subtotal: string;
};

/** The API could not be asked: not the same as an empty cart. */
export type CartUnavailable = { status: "unavailable" };

/** What `getCart()` returns: no cart (`null`), a cart, or an outage. */
export type CartLoad = CartView | CartUnavailable | null;

export function isCartUnavailable(cart: CartLoad): cart is CartUnavailable {
  return cart !== null && "status" in cart;
}

export type AddToCartAction = (variantId: string, quantity?: number) => Promise<CartActionState>;
export type UpdateLineAction = (lineId: string, quantity: number) => Promise<CartActionState>;
export type RemoveLineAction = (lineId: string) => Promise<CartActionState>;
