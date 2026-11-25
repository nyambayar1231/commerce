import "server-only";

import {
  AccountAddressesDocument,
  AccountOrderDocument,
  AccountOrdersDocument,
  AccountOverviewDocument,
} from "@/gql/graphql";
import { ApiError, type ApiResult, sessionQuery } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAddressView, toOrderDetail, toOrderSummary } from "./mappers";
import type {
  AccountOverviewView,
  AddressBookView,
  OrderDetailView,
  OrdersPageView,
} from "./types";

// Per-customer reads for the account pages (ARCHITECTURE §10.10): `sessionQuery`, so they send the
// session, are never cached across requests, and fail as a result (never a thrown 500).

export const ORDERS_PER_PAGE = 20;

/**
 * Pages render beside the layout's gate, not after it, so a guest's request reaches the loaders
 * too: they ask the session first (one cached read, no API call without a cookie).
 */
async function signedIn(): Promise<boolean> {
  return (await getCurrentUser()).status === "authenticated";
}

function mapped<T, R>(result: ApiResult<T>, map: (data: T) => R | null): ApiResult<R> | null {
  if (!result.ok) return result;
  const view = map(result.data);
  return view === null ? null : { ok: true, data: view };
}

/**
 * No signed-in customer: a guest (whom the layout shows the sign-in form instead of this page) or
 * a session that ended between the layout's check and this read. Not a `graphql` error, so the
 * order page never mistakes it for "no such order".
 */
const signedOut: ApiResult<never> = {
  ok: false,
  error: new ApiError({
    kind: "http",
    status: 401,
    operation: "account",
    requestId: "",
    message: "no signed-in customer",
  }),
};

export async function getAccountOverview(): Promise<ApiResult<AccountOverviewView>> {
  if (!(await signedIn())) return signedOut;
  const result = await sessionQuery(AccountOverviewDocument);
  return (
    mapped(result, ({ me }) =>
      me
        ? {
            defaultShipping: me.defaultShippingAddress
              ? toAddressView(me.defaultShippingAddress)
              : null,
            defaultBilling: me.defaultBillingAddress
              ? toAddressView(me.defaultBillingAddress)
              : null,
            recentOrders: (me.orders?.edges ?? []).map(({ node }) => toOrderSummary(node)),
          }
        : null,
    ) ?? signedOut
  );
}

/** One page of the customer's orders, newest first; `after` goes forward, `before` goes back. */
export async function getOrdersPage(cursor: {
  after?: string;
  before?: string;
}): Promise<ApiResult<OrdersPageView>> {
  if (!(await signedIn())) return signedOut;
  const variables = cursor.before
    ? { last: ORDERS_PER_PAGE, before: cursor.before }
    : { first: ORDERS_PER_PAGE, after: cursor.after };
  const result = await sessionQuery(AccountOrdersDocument, { variables });
  return (
    mapped(result, ({ me }) => {
      if (!me) return null;
      const connection = me.orders;
      return {
        orders: (connection?.edges ?? []).map(({ node }) => toOrderSummary(node)),
        previousCursor: connection?.pageInfo.hasPreviousPage
          ? connection.pageInfo.startCursor
          : null,
        nextCursor: connection?.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null,
      };
    }) ?? signedOut
  );
}

/**
 * One of the customer's orders. The API refuses another customer's order and an unknown id alike
 * with a GraphQL error, so `error.kind === "graphql"` and `data === null` both mean "no such
 * order for you" (the page answers 404); other failures are outages.
 */
export async function getAccountOrder(id: string): Promise<ApiResult<OrderDetailView | null>> {
  if (!(await signedIn())) return signedOut;
  const result = await sessionQuery(AccountOrderDocument, { variables: { id } });
  if (!result.ok) return result;
  const { order } = result.data;
  return { ok: true, data: order ? toOrderDetail(order) : null };
}

export async function getAddressBook(): Promise<ApiResult<AddressBookView>> {
  if (!(await signedIn())) return signedOut;
  const result = await sessionQuery(AccountAddressesDocument);
  return (
    mapped(result, ({ me, shop }) =>
      me
        ? {
            addresses: me.addresses.map(toAddressView).filter((address) => address.id !== ""),
            countries: shop.countries.map(({ code, country }) => ({ code, name: country })),
          }
        : null,
    ) ?? signedOut
  );
}
