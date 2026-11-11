// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { OrderDetailsPage } from "./OrderDetailsPage";

// The canvas grid needs a real browser; the card around it is what is tested here.
vi.mock("../OrderDetailsDatagrid/OrderDetailsDatagrid", () => ({
  OrderDetailsDatagrid: ({ lines }: { lines: unknown[] }) => (
    <div data-test-id="lines-grid">{lines.length}</div>
  ),
}));

afterEach(cleanup);

const money = (amount: number) => ({ __typename: "Money" as const, amount, currency: "MNT" });
const taxed = (amount: number) => ({
  __typename: "TaxedMoney" as const,
  gross: money(amount),
  tax: money(0),
});
const address = {
  __typename: "Address" as const,
  city: "Ulaanbaatar",
  cityArea: "",
  companyName: "",
  country: { __typename: "CountryDisplay" as const, code: "MN", country: "Mongolia" },
  countryArea: "",
  firstName: "Bat",
  lastName: "Dorj",
  phone: null,
  postalCode: "",
  streetAddress1: "Peace Ave 1",
  streetAddress2: "",
};

const order = (overrides: Partial<OrderDetailsFragment> = {}): OrderDetailsFragment => ({
  __typename: "Order",
  id: "o1",
  number: "7",
  created: "2026-11-11T10:00:00Z",
  status: "UNFULFILLED",
  userEmail: "bat@example.com",
  shippingMethodName: "Standard",
  billingAddress: address,
  shippingAddress: address,
  lines: [
    {
      __typename: "OrderLine",
      id: "l1",
      productName: "Boots",
      productSku: "B-42",
      variantName: "42",
      quantity: 2,
      quantityFulfilled: 0,
      unitPrice: taxed(1000),
      totalPrice: taxed(2000),
      variant: null,
    },
  ],
  subtotal: taxed(2000),
  shippingPrice: taxed(500),
  total: taxed(2500),
  chargeStatus: "FULL",
  authorizeStatus: "FULL",
  totalAuthorized: money(0),
  totalCharged: money(2500),
  totalBalance: money(0),
  transactions: [
    {
      __typename: "TransactionItem",
      id: "t1",
      name: "Dummy payment",
      pspReference: "psp-1",
      externalUrl: "",
      createdAt: "2026-11-11T10:00:00Z",
      events: [
        {
          __typename: "TransactionEvent",
          id: "e1",
          pspReference: "psp-1",
          amount: money(2500),
          type: "CHARGE_SUCCESS",
          message: "",
          createdAt: "2026-11-11T10:00:00Z",
          externalUrl: "",
        },
      ],
      authorizedAmount: money(0),
      chargedAmount: money(2500),
      refundedAmount: money(0),
      canceledAmount: money(0),
      authorizePendingAmount: money(0),
      chargePendingAmount: money(0),
      refundPendingAmount: money(0),
      cancelPendingAmount: money(0),
    },
  ],
  events: [
    {
      __typename: "OrderEvent",
      id: "ev1",
      date: "2026-11-11T10:00:00Z",
      type: "PLACED",
      user: null,
    },
  ],
  ...overrides,
});

const renderPage = (value?: OrderDetailsFragment) =>
  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter>
          <OrderDetailsPage order={value} />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );

const text = () => document.body.textContent ?? "";

describe("OrderDetailsPage", () => {
  it("shows Saleor's read-only cards for an order", () => {
    renderPage(order());

    expect(text()).toContain("Order #7");
    expect(screen.getByText("Unfulfilled")).toBeTruthy();
    expect(text()).toContain("Unfulfilled order lines");
    expect(document.querySelector('[data-test-id="lines-grid"]')?.textContent).toBe("1");
    expect(text()).toContain("Fully charged");
    expect(text()).toContain("Total captured");
    expect(text()).toContain("Transaction #1 on");
    expect(text()).toContain("Dummy payment");
    expect(document.querySelectorAll('[data-test-id="transaction-event"]')).toHaveLength(1);
    expect(text()).toContain("Order was placed");
    expect(text()).toContain("bat@example.com");
    expect(text()).toContain("Peace Ave 1");
  });

  it("hides fulfilled lines and shows the payment and transaction empty states", () => {
    const placed = order();

    renderPage(
      order({
        lines: placed.lines.map((line) => ({ ...line, quantityFulfilled: line.quantity })),
        transactions: [],
        chargeStatus: "NONE",
        authorizeStatus: "NONE",
      }),
    );

    expect(text()).not.toContain("Unfulfilled order lines");
    expect(text()).toContain("No payment received");
    expect(text()).toContain("No transactions made for this order.");
  });

  it("says when the customer or addresses are missing", () => {
    renderPage(order({ userEmail: null, shippingAddress: null, billingAddress: null }));

    expect(screen.getAllByText("Not set")).toHaveLength(3);
  });

  it("shows skeletons while loading", () => {
    renderPage(undefined);

    expect(text()).not.toContain("Order #");
  });
});
