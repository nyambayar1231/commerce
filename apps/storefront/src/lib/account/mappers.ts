import type {
  AccountAddressFragment,
  AccountOrderDetailFragment,
  AccountOrderSummaryFragment,
} from "@/gql/graphql";
import { formatDate, formatMoney } from "@/lib/format";
import { toMoney } from "@/lib/money";
import type {
  AddressView,
  OrderDetailView,
  OrderStatusKey,
  OrderSummaryView,
  PaymentStateKey,
  TimelineEntryView,
} from "./types";

// The one place account API data becomes view models (ARCHITECTURE §10.3): money and dates are
// formatted here, on the server, so no component does money math or date formatting.

type Money = { amount: number; currency: string };
const money = (value: { gross: Money }): string => formatMoney(toMoney(value.gross));

export function toAddressView(address: AccountAddressFragment): AddressView {
  return {
    id: address.id ?? "",
    firstName: address.firstName,
    lastName: address.lastName,
    companyName: address.companyName,
    streetAddress1: address.streetAddress1,
    streetAddress2: address.streetAddress2,
    city: address.city,
    cityArea: address.cityArea,
    postalCode: address.postalCode,
    countryArea: address.countryArea,
    countryCode: address.country.code,
    countryName: address.country.country,
    phone: address.phone ?? "",
    isDefaultShipping: address.isDefaultShippingAddress === true,
    isDefaultBilling: address.isDefaultBillingAddress === true,
  };
}

/**
 * The statuses a customer sees. `DRAFT` never reaches a customer (the API hides drafts); anything
 * else the API may add later reads as unfulfilled rather than breaking the page.
 */
export function orderStatusKey(status: string): OrderStatusKey {
  switch (status) {
    case "FULFILLED":
    case "PARTIALLY_FULFILLED":
    case "CANCELED":
      return status;
    default:
      return "UNFULFILLED";
  }
}

export function paymentStateKey(chargeStatus: string): PaymentStateKey {
  switch (chargeStatus) {
    case "PARTIAL":
      return "partial";
    case "FULL":
      return "full";
    case "OVERCHARGED":
      return "overcharged";
    default:
      return "none";
  }
}

export function toOrderSummary(order: AccountOrderSummaryFragment): OrderSummaryView {
  return {
    id: order.id,
    number: order.number,
    createdIso: order.created,
    createdLabel: formatDate(order.created, "long"),
    status: orderStatusKey(order.status),
    total: money(order.total),
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/**
 * Placed, each fulfillment (cancelled ones are not shipments) and cancellation, newest first. The
 * API keeps no cancellation date for customers, so `updatedAt` stands in for it. Only data the
 * customer may read: staff events are never requested.
 */
export function orderTimeline(order: AccountOrderDetailFragment): TimelineEntryView[] {
  const entries: TimelineEntryView[] = [
    { kind: "placed", iso: order.created, label: formatDate(order.created, "long") },
  ];
  for (const fulfillment of order.fulfillments) {
    if (fulfillment.status === "CANCELED") continue;
    entries.push({
      kind: "fulfilled",
      iso: fulfillment.created,
      label: formatDate(fulfillment.created, "long"),
      itemCount: (fulfillment.lines ?? []).reduce((sum, line) => sum + line.quantity, 0),
      trackingNumber: fulfillment.trackingNumber,
    });
  }
  if (order.status === "CANCELED") {
    entries.push({
      kind: "canceled",
      iso: order.updatedAt,
      label: formatDate(order.updatedAt, "long"),
    });
  }
  // Stable sort: entries of the same instant keep placed, fulfilled, canceled order.
  return entries.sort((a, b) => Date.parse(b.iso) - Date.parse(a.iso));
}

export function toOrderDetail(order: AccountOrderDetailFragment): OrderDetailView {
  return {
    ...toOrderSummary(order),
    paymentState: paymentStateKey(order.chargeStatus),
    lines: order.lines.map((line) => ({
      id: line.id,
      productName: line.productName,
      variantName: line.variantName,
      quantity: line.quantity,
      unitPrice: money(line.unitPrice),
      totalPrice: money(line.totalPrice),
    })),
    subtotal: money(order.subtotal),
    shipping: money(order.shippingPrice),
    shippingMethod: order.shippingMethodName?.trim() || null,
    shippingAddress: order.shippingAddress ? toAddressView(order.shippingAddress) : null,
    billingAddress: order.billingAddress ? toAddressView(order.billingAddress) : null,
    timeline: orderTimeline(order),
  };
}
