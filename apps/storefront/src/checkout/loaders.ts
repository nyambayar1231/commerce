import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import {
  CheckoutCountriesDocument,
  CheckoutDetailsDocument,
  CheckoutSavedAddressesDocument,
  OrderByTokenDocument,
} from "@/gql/graphql";
import { toAddressView } from "@/lib/account/mappers";
import type { AddressView, CountryOption } from "@/lib/account/types";
import { cachedQuery, sessionQuery, tags } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkoutGlobalId, readCheckoutToken } from "@/lib/cart/cookies";
import { toCheckoutView, toOrderConfirmation } from "./mappers";
import type { CheckoutPageLoad, CheckoutSession, OrderConfirmationView } from "./types";

// Render-only reads of the checkout and order pages (ARCHITECTURE §10.9): `sessionQuery`, so they
// send the session, are never cached across requests and fail as a result, not a thrown 500.

async function getCountriesCached(): Promise<CountryOption[]> {
  "use cache";
  const data = await cachedQuery(CheckoutCountriesDocument, { tags: [tags.shop] });
  return data.shop.countries.map(({ code, country }) => ({ code, name: country }));
}

/** The countries the shop ships to (shared cache, like the shop's name). */
async function getCountries(): Promise<CountryOption[]> {
  await connection();
  return getCountriesCached();
}

async function getSavedAddresses(): Promise<AddressView[]> {
  const result = await sessionQuery(CheckoutSavedAddressesDocument);
  // Saved addresses are a convenience: without them the shopper types the address.
  if (!result.ok || result.data.me === null) return [];
  return result.data.me.addresses.map(toAddressView).filter((address) => address.id !== "");
}

/**
 * Everything the checkout page shows, once per request. No cookie, an unknown checkout or one
 * without lines is `empty` (Paper's empty-cart view); an API outage is `unavailable`, never an
 * empty cart. The API refuses writes to a completed checkout but still reads it: the cookie is
 * cleared when completion succeeds, so a completed one reads as a cart only until then.
 */
export const getCheckoutPage = cache(async (): Promise<CheckoutPageLoad> => {
  const token = await readCheckoutToken();
  if (token === null) return { status: "empty" };
  const [result, user, countries] = await Promise.all([
    sessionQuery(CheckoutDetailsDocument, { variables: { id: checkoutGlobalId(token) } }),
    getCurrentUser(),
    getCountries().catch(() => null),
  ]);
  if (!result.ok || countries === null) return { status: "unavailable" };
  if (result.data.checkout === null || result.data.checkout.lines.length === 0) {
    return { status: "empty" };
  }

  const session: CheckoutSession =
    user.status === "authenticated"
      ? {
          status: "authenticated",
          email: user.user.email,
          firstName: user.user.firstName,
          lastName: user.user.lastName,
        }
      : { status: "guest" };
  return {
    status: "ready",
    checkout: toCheckoutView(result.data.checkout),
    session,
    savedAddresses: session.status === "authenticated" ? await getSavedAddresses() : [],
    countries,
  };
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The order behind a token (the random token is the credential, ARCHITECTURE §4, M15.3): the view,
 * `null` for an unknown token or one that is not a UUID (404), or `"unavailable"` for an outage.
 */
export async function getOrderByToken(
  token: string,
): Promise<OrderConfirmationView | null | "unavailable"> {
  if (!UUID.test(token)) return null;
  const result = await sessionQuery(OrderByTokenDocument, { variables: { token } });
  if (!result.ok) return "unavailable";
  return result.data.orderByToken === null ? null : toOrderConfirmation(result.data.orderByToken);
}
