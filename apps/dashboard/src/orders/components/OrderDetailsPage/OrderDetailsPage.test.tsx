// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createIntl } from "react-intl";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { getEventDetails } from "../OrderHistory/OrderHistory";
import { canCancelOrder, OrderDetailsPage } from "./OrderDetailsPage";

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
  actions: [],
  userEmail: "bat@example.com",
  user: null,
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
      quantityToFulfill: 2,
      unitPrice: taxed(1000),
      totalPrice: taxed(2000),
      variant: null,
    },
  ],
  fulfillments: [],
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
      actions: ["REFUND"],
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
      amount: null,
      transactionReference: null,
      lines: null,
      fulfilledItems: null,
      user: null,
    },
  ],
  ...overrides,
});

const renderPage = (
  value?: OrderDetailsFragment,
  handlers: { onRefund?: (id: string) => void } = { onRefund: vi.fn() },
) => {
  const props = {
    onOrderFulfill: vi.fn(),
    onOrderCancel: vi.fn(),
    onMarkAsPaid: vi.fn(),
    ...handlers,
  };
  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter>
          <OrderDetailsPage order={value} {...props} />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );
  return props;
};

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-test-id="${id}"]`);

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

    // The customer says "Not set"; an order without addresses shows none at all (the shop doesn't
    // ship or take addresses yet).
    expect(screen.getAllByText("Not set")).toHaveLength(1);
    expect(document.querySelector('[data-test-id="shipping-address-section"]')).toBeNull();
    expect(document.querySelector('[data-test-id="billing-address-section"]')).toBeNull();
  });

  it("links a customer account's order to the customer's profile", () => {
    renderPage(order());
    expect(byTestId("view-profile")).toBeNull();
    cleanup();

    renderPage(order({ user: { __typename: "User", id: "VXNlcjox" } }));
    expect(byTestId("view-profile")?.getAttribute("href")).toBe("/customers/VXNlcjox");
  });

  it("offers Fulfill, Refund and the cancel menu for an unfulfilled order", () => {
    const props = renderPage(order());

    byTestId("order-items-fulfill-button")?.click();
    expect(props.onOrderFulfill).toHaveBeenCalled();
    byTestId("transaction-action-refund-button")?.click();
    expect(props.onRefund).toHaveBeenCalledWith("t1");
    expect(byTestId("show-more-button")).toBeTruthy();
    // Fully charged: nothing to mark as paid.
    expect(byTestId("mark-as-paid-button")).toBeNull();
  });

  it("shows Mark as Paid while the order's actions allow it", () => {
    const props = renderPage(order({ actions: ["MARK_AS_PAID"] }));

    byTestId("mark-as-paid-button")?.click();
    expect(props.onMarkAsPaid).toHaveBeenCalled();
  });

  it("hides Refund from staff without HANDLE_PAYMENTS and for a transaction without REFUND", () => {
    renderPage(order(), { onRefund: undefined });
    expect(byTestId("transaction-action-refund-button")).toBeNull();
    cleanup();

    const placed = order();
    renderPage(
      order({
        transactions: placed.transactions.map((transaction) => ({ ...transaction, actions: [] })),
      }),
    );
    expect(byTestId("transaction-action-refund-button")).toBeNull();
  });

  it("shows fulfillments and no Fulfill button or cancel menu once everything is fulfilled", () => {
    const placed = order();
    const [first] = placed.lines;
    if (!first) throw new Error("no line");
    const line = { ...first, quantityFulfilled: 2, quantityToFulfill: 0 };
    renderPage(
      order({
        status: "FULFILLED",
        lines: [line],
        fulfillments: [
          {
            __typename: "Fulfillment",
            id: "f1",
            fulfillmentOrder: 1,
            status: "FULFILLED",
            created: "2026-11-11T11:00:00Z",
            warehouse: { __typename: "Warehouse", id: "w1", name: "Main" },
            lines: [{ __typename: "FulfillmentLine", id: "fl1", quantity: 2, orderLine: line }],
          },
        ],
      }),
    );

    expect(text()).toContain("Fulfilled #1");
    expect(text()).toContain("From Main");
    expect(byTestId("lines-grid")?.textContent).toBe("1");
    expect(byTestId("order-items-fulfill-button")).toBeNull();
    expect(byTestId("show-more-button")).toBeNull();
  });

  it("can cancel only an order that isn't canceled and has no fulfillment", () => {
    expect(canCancelOrder({ status: "UNFULFILLED", fulfillments: [] })).toBe(true);
    expect(canCancelOrder({ status: "CANCELED", fulfillments: [] })).toBe(false);
    expect(canCancelOrder(order({ fulfillments: [{} as never] }))).toBe(false);
  });

  it("describes events: fulfilled items, refund amount, mark-as-paid reference", () => {
    const intl = createIntl({ locale: "en" });
    const empty = { fulfilledItems: null, lines: null, transactionReference: null, amount: null };

    expect(
      getEventDetails(
        {
          ...empty,
          fulfilledItems: [
            {
              __typename: "FulfillmentLine",
              id: "fl1",
              quantity: 2,
              orderLine: {
                __typename: "OrderLine",
                id: "l1",
                productName: "Boots",
                variantName: "42",
              },
            },
          ],
        },
        intl,
        "MNT",
      ),
    ).toBe("2 × Boots (42)");
    expect(
      getEventDetails({ ...empty, amount: 1000, transactionReference: "psp-1" }, intl, "MNT"),
    ).toMatch(/^MNT\s1,000$/);
    expect(getEventDetails({ ...empty, transactionReference: "BANK-42" }, intl, "MNT")).toBe(
      "Transaction Reference: BANK-42",
    );
    expect(getEventDetails(empty, intl, "MNT")).toBeNull();
  });

  it("prints the order: the Print button opens the browser's print dialog on the print view", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPage(order({ shippingMethodName: "Express", billingAddress: null }));

    byTestId("print-order-button")?.click();
    expect(print).toHaveBeenCalledOnce();

    const view = byTestId("order-print-view");
    expect(view?.parentElement).toBe(document.body);
    const printed = view?.textContent ?? "";
    expect(printed).toContain("Order #7");
    expect(printed).toContain("Status: Unfulfilled");
    expect(printed).toContain("bat@example.com");
    expect(printed).toContain("Peace Ave 1");
    expect(printed).toContain("Express");
    expect(printed).toContain("Boots");
    expect(printed).toContain("B-42");
    expect(document.querySelectorAll('[data-test-id="order-print-line"]')).toHaveLength(1);
    expect(byTestId("order-print-total")?.textContent).toBe("MNT 2,500");
    print.mockRestore();
  });

  it("shows skeletons while loading", () => {
    renderPage(undefined);

    expect(text()).not.toContain("Order #");
    expect(byTestId("print-order-button")).toBeNull();
    expect(byTestId("order-print-view")).toBeNull();
  });
});
