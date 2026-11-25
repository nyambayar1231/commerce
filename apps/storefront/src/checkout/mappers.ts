import type { CheckoutDetailsFragment, OrderByTokenQuery } from "@/gql/graphql";
import { toAddressView, toOrderDetail } from "@/lib/account/mappers";
import { toCartView } from "@/lib/cart/mappers";
import { formatMoney } from "@/lib/format";
import { toMoney } from "@/lib/money";
import type { CheckoutView, OrderConfirmationView, ShippingMethodView } from "./types";

// Generated GraphQL in, view models out; the one place checkout money becomes a formatted string
// on the server (ARCHITECTURE §10.11).

type Money = { amount: number; currency: string };
const money = (value: Money): string => formatMoney(toMoney(value));

function toShippingMethod(method: CheckoutDetailsFragment["shippingMethods"][number]) {
  return {
    id: method.id,
    name: method.name,
    price: money(method.price),
    message: method.message?.trim() ?? "",
    active: method.active,
  } satisfies ShippingMethodView;
}

export function toCheckoutView(checkout: CheckoutDetailsFragment): CheckoutView {
  const cart = toCartView(checkout);
  const email = checkout.email?.trim() || null;
  const shippingMethodId = checkout.delivery?.shippingMethod?.id ?? null;
  return {
    token: cart.token,
    email,
    isShippingRequired: checkout.isShippingRequired,
    lines: cart.lines,
    quantity: cart.quantity,
    shippingAddress: checkout.shippingAddress ? toAddressView(checkout.shippingAddress) : null,
    billingAddress: checkout.billingAddress ? toAddressView(checkout.billingAddress) : null,
    shippingMethods: checkout.shippingMethods.map(toShippingMethod),
    shippingMethodId,
    subtotal: cart.subtotal,
    shipping: money(checkout.shippingPrice.gross),
    total: money(checkout.totalPrice.gross),
    hasEmail: email !== null,
    hasShippingAddress: checkout.shippingAddress !== null,
    hasDeliveryMethod: shippingMethodId !== null,
  };
}

type OrderFound = NonNullable<OrderByTokenQuery["orderByToken"]>;

/** The confirmation page's data: the customer's order view plus the email it went to. */
export function toOrderConfirmation(order: OrderFound): OrderConfirmationView {
  return { order: toOrderDetail(order), email: order.userEmail?.trim() ?? "" };
}
