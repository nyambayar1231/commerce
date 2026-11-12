// Adapted from saleor-core: saleor/plugins/user_email/default_email_templates/confirm_order.html and
// constants.py (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order confirmation email (PLAN M8.2): Saleor's "Order #{number} details" with its wording,
// summary, lines table and addresses, as plain text and simple HTML (no MJML, no remote fonts).
// Checkout completion adds the job inside its transaction (ARCHITECTURE.md §5.6), so a rolled-back
// order sends nothing; the worker renders the email from the stored order when it runs. Left out:
// the order details link (no storefront yet), discounts (none) and Saleor's net prices (ours are
// gross, taxes included at 0).
import { CURRENCIES, type CurrencyCode } from "@commerce/contracts";
import type { Tx } from "@commerce/db";
import { defineJobHandler, defineQueue, type EmailMessage, enqueue } from "../jobs/index.ts";
import { getShop } from "../shop/index.ts";
import { getOrder, getOrderLinesByOrderIds, type OrderLineRow, type OrderRow } from "./orders.ts";

export const orderConfirmationQueue = defineQueue<{ orderId: string }>("order-confirmation-email");

/** Adds the confirmation job inside the transaction that places the order. */
export const enqueueOrderConfirmation = (tx: Tx, orderId: string) =>
  enqueue(tx, orderConfirmationQueue, { orderId });

/** "MNT 45,000": the currency's own decimals (none for MNT, ADR-0013). */
export const formatPrice = (amountMinor: number, currency: string): string => {
  const exponent = CURRENCIES[currency as CurrencyCode]?.exponent ?? 2;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  })
    .format(amountMinor / 10 ** exponent)
    .replace(/ /g, " ");
};

/** The stored address snapshot (ARCHITECTURE.md §3: orders copy the checkout's addresses). */
type StoredAddress = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "companyName"
    | "streetAddress1"
    | "streetAddress2"
    | "city"
    | "cityArea"
    | "postalCode"
    | "country"
    | "countryArea"
    | "phone",
    string
  >
>;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Saleor's format_address: name, company, street lines, city line, area, country, phone. */
export const formatAddress = (value: unknown): string[] => {
  const address = (value ?? {}) as StoredAddress;
  const country = address.country ? (regionNames.of(address.country) ?? address.country) : "";
  return [
    [address.firstName, address.lastName].filter(Boolean).join(" "),
    address.companyName,
    address.streetAddress1,
    address.streetAddress2,
    [address.postalCode, address.city, address.cityArea].filter(Boolean).join(" "),
    address.countryArea,
    country,
    address.phone,
  ].filter((line): line is string => Boolean(line?.trim()));
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const lineName = (line: OrderLineRow): string =>
  line.variantName ? `${line.productName} (${line.variantName})` : line.productName;

/** Renders the email for an order (pure, so it is tested without a mail server). */
export function renderOrderConfirmation(
  order: OrderRow,
  lines: readonly OrderLineRow[],
  shopName: string,
): Omit<EmailMessage, "to"> {
  const price = (amount: number) => formatPrice(amount, order.currency);
  const subject = `Order #${order.number} details`;
  const intro = "Thank you for your order. Below is the list of ordered products.";
  const summary: [string, string][] = [
    ["Subtotal", price(order.subtotalAmount)],
    ["Shipping", price(order.shippingPriceAmount)],
    ["Taxes (included)", price(0)],
    ["Total", price(order.totalAmount)],
  ];
  const billing = formatAddress(order.billingAddress);
  const shipping = formatAddress(order.shippingAddress);

  const text = [
    "Hi!",
    "",
    intro,
    "",
    ...lines.map(
      (line) =>
        `${lineName(line)} × ${line.quantity}: ${price(line.unitPriceAmount)} each, ${price(line.totalPriceAmount)}`,
    ),
    "",
    ...summary.map(([label, value]) => `${label}: ${value}`),
    "",
    "Billing address:",
    ...(billing.length > 0 ? billing : ["No billing address"]),
    "",
    "Shipping address:",
    ...(shipping.length > 0 ? shipping : ["No shipping required"]),
    "",
    `Sincerely, ${shopName}`,
  ].join("\n");

  const cell = 'style="padding: 5px;"';
  const right = 'style="padding: 5px; text-align: right;"';
  const addressHtml = (lines: string[], empty: string) =>
    lines.length > 0 ? lines.map(escapeHtml).join("<br>") : escapeHtml(empty);
  const html = `<!doctype html>
<html>
<body style="font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #000;">
<p>Hi!</p>
<p>${escapeHtml(intro)}</p>
<table style="border-collapse: collapse; width: 100%;">
<thead><tr><th ${cell} align="left">Item</th><th ${right}>Quantity</th><th ${right}>Per unit</th><th ${right}>Subtotal</th></tr></thead>
<tbody>
${lines
  .map(
    (line) =>
      `<tr><td ${cell}>${escapeHtml(lineName(line))}</td><td ${right}>${line.quantity}</td><td ${right}>${escapeHtml(price(line.unitPriceAmount))}</td><td ${right}>${escapeHtml(price(line.totalPriceAmount))}</td></tr>`,
  )
  .join("\n")}
</tbody>
</table>
<table style="border-collapse: collapse; margin-top: 16px;">
${summary
  .map(
    ([label, value]) =>
      `<tr><td ${cell}>${label === "Total" ? `<strong>${label}</strong>` : label}</td><td ${right}>${label === "Total" ? `<strong>${escapeHtml(value)}</strong>` : escapeHtml(value)}</td></tr>`,
  )
  .join("\n")}
</table>
<table style="border-collapse: collapse; margin-top: 16px; width: 100%;">
<tr><th ${cell} align="left">Billing address</th><th ${cell} align="left">Shipping address</th></tr>
<tr><td ${cell} valign="top">${addressHtml(billing, "No billing address")}</td><td ${cell} valign="top">${addressHtml(shipping, "No shipping required")}</td></tr>
</table>
<p style="text-align: center;">Sincerely, ${escapeHtml(shopName)}</p>
</body>
</html>`;

  return { subject, text, html };
}

/** The worker's handler: renders the stored order and sends it to the order's email. */
export const orderConfirmationHandler = defineJobHandler(
  orderConfirmationQueue,
  async ({ orderId }, { db, mailer }) => {
    const order = await getOrder(db, orderId);
    // A deleted order (none today) has nothing left to confirm; finishing the job is right.
    if (!order) return;
    const [lines, shop] = await Promise.all([getOrderLinesByOrderIds(db, [orderId]), getShop(db)]);
    await mailer.send({ to: order.userEmail, ...renderOrderConfirmation(order, lines, shop.name) });
  },
);
