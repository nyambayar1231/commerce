import "server-only";

import { cache } from "react";
import { CartByTokenDocument } from "@/gql/graphql";
import { sessionQuery } from "@/lib/api";
import { checkoutGlobalId, readCheckoutToken } from "./cookies";
import { toCartView } from "./mappers";
import type { CartLoad } from "./types";

/**
 * The shopper's cart, once per request (ARCHITECTURE §10.9). No cookie (or one that is not a
 * UUID) means no cart, without asking the API; a checkout the API does not know is no cart either.
 * An API outage is `{ status: "unavailable" }`, never an empty cart.
 *
 * The API gives no sign that a checkout is completed, so a completed one reads as a cart until
 * checkout completion clears the cookie (M4.6) or the next add replaces it.
 */
export const getCart = cache(async (): Promise<CartLoad> => {
  const token = await readCheckoutToken();
  if (token === null) return null;
  const result = await sessionQuery(CartByTokenDocument, {
    variables: { id: checkoutGlobalId(token) },
  });
  if (!result.ok) return { status: "unavailable" };
  return result.data.checkout === null ? null : toCartView(result.data.checkout);
});
