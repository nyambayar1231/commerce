// The printed order (PLAN M13 decision 4). Saleor has no print view (its closest feature is
// plugin-generated invoices), so this is our own: number, date, status, customer, addresses,
// shipping method, lines and totals in plain black on white. It is mounted on <body> and hidden
// on screen; while printing, its stylesheet hides everything else, so both the page's Print
// button and the browser's own Print show it. The addresses and shipping (method, cost) are
// printed only for an order that has them: the shop doesn't ship or take addresses yet (owner,
// 2026-11-14).
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { defineMessage, defineMessages, FormattedMessage, useIntl } from "react-intl";

import {
  getAddressCityLine,
  getAddressCountryLine,
  getAddressDisplayName,
  getAddressStreetLine,
} from "../../../components/ReadonlyAddress/ReadonlyAddress";
import type { AddressFragment, OrderDetailsFragment } from "../../../graphql/types.generated";
import { transformOrderStatus } from "../../../misc";
import { hasShipping } from "../OrderSummary/OrderValue";
import styles from "./OrderPrintView.module.css";

const titleMessage = defineMessage<{ orderNumber: string }>({
  id: "AqXzM2",
  defaultMessage: "Order #{orderNumber}",
});
const placedMessage = defineMessage<{ date: string }>({
  id: "V6z6Se",
  defaultMessage: "Placed {date}",
  description: "printed order",
});
const statusMessage = defineMessage<{ status: string }>({
  id: "WVbUh7",
  defaultMessage: "Status: {status}",
  description: "printed order",
});

const messages = defineMessages({
  customer: { id: "hkENym", defaultMessage: "Customer" },
  shippingAddress: { id: "ZpVtCa", defaultMessage: "Shipping address" },
  billingAddress: { id: "6orx1c", defaultMessage: "Billing address" },
  shippingMethod: {
    id: "527G9G",
    defaultMessage: "Shipping method",
    description: "printed order",
  },
  product: { id: "x/ZVlU", defaultMessage: "Product" },
  sku: { id: "k4brJy", defaultMessage: "SKU" },
  quantity: { id: "tvpAXl", defaultMessage: "Quantity", description: "ordered product quantity" },
  unitPrice: { id: "lNcdXC", defaultMessage: "Unit price", description: "printed order line" },
  lineTotal: { id: "qT6YYk", defaultMessage: "Total", description: "order line total price" },
  subtotal: { id: "L8seEc", defaultMessage: "Subtotal" },
  shipping: { id: "glR0om", defaultMessage: "Shipping" },
  total: { id: "MJ2jZQ", defaultMessage: "Total" },
});

const EMPTY = "—";

/** An address's lines as ReadonlyAddress prints them, empty parts left out. */
export const addressLines = (address: AddressFragment): string[] =>
  [
    getAddressDisplayName(address),
    address.companyName,
    address.phone,
    getAddressStreetLine(address),
    getAddressCityLine(address),
    getAddressCountryLine(address),
  ].filter((line): line is string => Boolean(line));

const Field = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className={styles.field}>
    <div className={styles.label}>{label}</div>
    {children}
  </div>
);

const Address = ({ address }: { address: AddressFragment | null }) =>
  address ? (
    <address className={styles.address}>
      {addressLines(address).map((line) => (
        <div key={line}>{line}</div>
      ))}
    </address>
  ) : (
    <div>{EMPTY}</div>
  );

export const OrderPrintView = ({ order }: { order: OrderDetailsFragment }) => {
  const intl = useIntl();
  const money = (amount: number) => intl.formatNumber(amount, { maximumFractionDigits: 0 });
  const currency = order.total.gross.currency;
  const { localized: status } = transformOrderStatus(order.status, intl);

  return createPortal(
    <div className={styles.root} data-order-print="" data-test-id="order-print-view">
      <header className={styles.header}>
        <h1 className={styles.title}>
          {intl.formatMessage(titleMessage, { orderNumber: order.number })}
        </h1>
        <div>
          {intl.formatMessage(placedMessage, {
            date: intl.formatDate(String(order.created), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </div>
        <div>{intl.formatMessage(statusMessage, { status })}</div>
      </header>

      <section className={styles.details}>
        <Field label={<FormattedMessage {...messages.customer} />}>
          <div>{order.userEmail || EMPTY}</div>
        </Field>
        {order.billingAddress && (
          <Field label={<FormattedMessage {...messages.billingAddress} />}>
            <Address address={order.billingAddress} />
          </Field>
        )}
        {order.shippingAddress && (
          <Field label={<FormattedMessage {...messages.shippingAddress} />}>
            <Address address={order.shippingAddress} />
          </Field>
        )}
        {order.shippingMethodName && (
          <Field label={<FormattedMessage {...messages.shippingMethod} />}>
            <div>{order.shippingMethodName}</div>
          </Field>
        )}
      </section>

      <table className={styles.lines}>
        <thead>
          <tr>
            <th>
              <FormattedMessage {...messages.product} />
            </th>
            <th>
              <FormattedMessage {...messages.sku} />
            </th>
            <th className={styles.number}>
              <FormattedMessage {...messages.quantity} />
            </th>
            <th className={styles.number}>
              <FormattedMessage {...messages.unitPrice} />
            </th>
            <th className={styles.number}>
              <FormattedMessage {...messages.lineTotal} />
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id} data-test-id="order-print-line">
              <td>
                <div>{line.productName}</div>
                {line.variantName && <div className={styles.variant}>{line.variantName}</div>}
              </td>
              <td>{line.productSku || EMPTY}</td>
              <td className={styles.number}>{line.quantity}</td>
              <td className={styles.number}>{money(line.unitPrice.gross.amount)}</td>
              <td className={styles.number}>{money(line.totalPrice.gross.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className={styles.totals}>
        <dt>
          <FormattedMessage {...messages.subtotal} />
        </dt>
        <dd>{money(order.subtotal.gross.amount)}</dd>
        {hasShipping(order) && (
          <>
            <dt>
              <FormattedMessage {...messages.shipping} />
            </dt>
            <dd>{money(order.shippingPrice.gross.amount)}</dd>
          </>
        )}
        <dt className={styles.grandTotal}>
          <FormattedMessage {...messages.total} />
        </dt>
        <dd className={styles.grandTotal} data-test-id="order-print-total">
          {currency} {money(order.total.gross.amount)}
        </dd>
      </dl>
    </div>,
    document.body,
  );
};
