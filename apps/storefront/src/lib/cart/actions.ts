"use server";

import { refresh } from "next/cache";
import {
  CartByTokenDocument,
  CheckoutCreateDocument,
  CheckoutLinesAddDocument,
  CheckoutLinesDeleteDocument,
  CheckoutLinesUpdateDocument,
} from "@/gql/graphql";
import { mutate } from "@/lib/api";
import { checkoutGlobalId, readCheckoutToken, setCheckoutCookie } from "./cookies";
import type { CartActionState, CartErrorKey } from "./types";

// Cart Server Actions (ARCHITECTURE §10.9). Next checks each action's Origin against the host.
// The client never sends a price: it names a variant or a line and a quantity, and the cart is
// re-read from the API after every success. Only async functions are exported: everything
// exported here is callable from a browser.

const MAX_QUANTITY = 99;
/** A global id is base64 of "<Type>:<uuid>" (or url-safe base64). */
const GLOBAL_ID = /^[A-Za-z0-9+/_-]{8,200}={0,2}$/;

type CartError = { code: string; field?: string | null };

const ERROR_KEYS: Record<string, CartErrorKey> = {
  INSUFFICIENT_STOCK: "insufficientStock",
  QUANTITY_GREATER_THAN_LIMIT: "quantityLimit",
  PRODUCT_NOT_PUBLISHED: "notAvailable",
  ZERO_QUANTITY: "invalidQuantity",
  INVALID: "invalidQuantity",
  NOT_FOUND: "notAvailable",
};

const failure = (message: CartErrorKey): CartActionState => ({ status: "error", message });

function errorKey(errors: readonly CartError[]): CartErrorKey {
  const first = errors[0];
  if (first === undefined) return "generic";
  // The API refuses writes to a completed checkout with INVALID on the `id` field.
  if (first.code === "INVALID" && first.field === "id") return "generic";
  return Object.hasOwn(ERROR_KEYS, first.code)
    ? (ERROR_KEYS[first.code] as CartErrorKey)
    : "generic";
}

/** The API refused a write because the checkout is already completed. */
const isCompleted = (errors: readonly CartError[]) =>
  errors.some((error) => error.code === "INVALID" && error.field === "id");

/** Renews the cookie's 30 days and re-renders the header count, drawer and cart page. */
async function succeed(token: string): Promise<CartActionState> {
  await setCheckoutCookie(token);
  refresh();
  return { status: "success" };
}

/** Adds one variant, creating the checkout when there is none, or when it is gone or completed. */
/** True unless the API says the checkout is gone (or can't be read: then keep it, to be safe). */
async function checkoutStillExists(token: string): Promise<boolean> {
  const result = await mutate(CartByTokenDocument, { variables: { id: checkoutGlobalId(token) } });
  return !result.ok || result.data.checkout !== null;
}

export async function addToCart(variantId: string, quantity = 1): Promise<CartActionState> {
  if (typeof variantId !== "string" || !GLOBAL_ID.test(variantId)) return failure("notAvailable");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return failure("invalidQuantity");
  }
  const lines = [{ variantId, quantity }];

  const token = await readCheckoutToken();
  if (token !== null) {
    const result = await mutate(CheckoutLinesAddDocument, {
      variables: { id: checkoutGlobalId(token), lines },
    });
    if (result.ok) {
      const payload = result.data.checkoutLinesAdd;
      if (payload?.checkout && payload.errors.length === 0) return succeed(token);
      const errors = payload?.errors ?? [];
      if (!isCompleted(errors)) return failure(errorKey(errors));
      // Completed: start a new checkout below.
    } else if (result.error.kind !== "graphql") {
      return failure("unavailable");
    } else if (await checkoutStillExists(token)) {
      // The error was about the request (e.g. a variant the API can't resolve), not the cart:
      // never replace a living cart with a new one.
      return failure("notAvailable");
    }
    // No such checkout any more, or a completed one: start a new checkout below.
  }

  const created = await mutate(CheckoutCreateDocument, { variables: { input: { lines } } });
  if (!created.ok) return failure("unavailable");
  const payload = created.data.checkoutCreate;
  if (!payload?.checkout || payload.errors.length > 0) {
    return failure(errorKey(payload?.errors ?? []));
  }
  return succeed(payload.checkout.token);
}

/** Sets a line's quantity (1-99); 0 removes the line. */
export async function updateLine(lineId: string, quantity: number): Promise<CartActionState> {
  if (typeof lineId !== "string" || !GLOBAL_ID.test(lineId)) return failure("notAvailable");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
    return failure("invalidQuantity");
  }
  if (quantity === 0) return removeLine(lineId);

  const token = await readCheckoutToken();
  if (token === null) return failure("generic");
  const result = await mutate(CheckoutLinesUpdateDocument, {
    variables: { id: checkoutGlobalId(token), lines: [{ lineId, quantity }] },
  });
  if (!result.ok) return failure("unavailable");
  const payload = result.data.checkoutLinesUpdate;
  if (!payload?.checkout || payload.errors.length > 0) {
    return failure(errorKey(payload?.errors ?? []));
  }
  return succeed(token);
}

export async function removeLine(lineId: string): Promise<CartActionState> {
  if (typeof lineId !== "string" || !GLOBAL_ID.test(lineId)) return failure("notAvailable");

  const token = await readCheckoutToken();
  if (token === null) return failure("generic");
  const result = await mutate(CheckoutLinesDeleteDocument, {
    variables: { id: checkoutGlobalId(token), linesIds: [lineId] },
  });
  if (!result.ok) return failure("unavailable");
  const payload = result.data.checkoutLinesDelete;
  if (!payload?.checkout || payload.errors.length > 0) {
    return failure(errorKey(payload?.errors ?? []));
  }
  return succeed(token);
}
