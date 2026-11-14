// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { SavebarRefProvider, useSavebarRef } from "../../../components/Savebar/SavebarRefContext";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { OrderDraftPage } from "./OrderDraftPage";

afterEach(cleanup);

const SavebarAnchor = () => {
  const { setAnchor } = useSavebarRef();

  return <div ref={setAnchor} />;
};

const money = (amount: number) => ({ __typename: "Money" as const, amount, currency: "MNT" });
const taxed = (amount: number) => ({
  __typename: "TaxedMoney" as const,
  gross: money(amount),
  tax: money(0),
});

const draft = (overrides: Partial<OrderDetailsFragment> = {}): OrderDetailsFragment => ({
  __typename: "Order",
  id: "o1",
  number: "22",
  created: "2026-11-14T10:00:00Z",
  status: "DRAFT",
  actions: [],
  userEmail: null,
  user: null,
  shippingMethodName: null,
  billingAddress: null,
  shippingAddress: null,
  lines: [
    {
      __typename: "OrderLine",
      id: "l1",
      productName: "Shirt",
      productSku: "S-1",
      variantName: "M",
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
  shippingPrice: taxed(0),
  total: taxed(2000),
  chargeStatus: "NONE",
  authorizeStatus: "NONE",
  totalAuthorized: money(0),
  totalCharged: money(0),
  totalBalance: money(-2000),
  transactions: [],
  events: [
    {
      __typename: "OrderEvent",
      id: "e1",
      date: "2026-11-14T10:00:00Z",
      type: "ADDED_PRODUCTS",
      amount: null,
      transactionReference: null,
      lines: [{ __typename: "OrderEventOrderLineObject", itemName: "Shirt (M)", quantity: 2 }],
      fulfilledItems: null,
      user: null,
    },
  ],
  ...overrides,
});

const renderPage = (order?: OrderDetailsFragment) => {
  const props = {
    disabled: false,
    finalizeState: "default" as const,
    onBack: vi.fn(),
    onDraftFinalize: vi.fn(),
    onDraftRemove: vi.fn(),
    onOrderLineAdd: vi.fn(),
    onOrderLineChange: vi.fn(),
    onOrderLineRemove: vi.fn(),
  };
  render(
    <ThemeProvider>
      <LocaleProvider>
        <SavebarRefProvider>
          <SavebarAnchor />
          <MemoryRouter>
            <OrderDraftPage order={order} {...props} />
          </MemoryRouter>
        </SavebarRefProvider>
      </LocaleProvider>
    </ThemeProvider>,
  );
  return props;
};

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-test-id="${id}"]`);
const text = () => document.body.textContent ?? "";

describe("OrderDraftPage", () => {
  it("shows the draft's lines, summary and history with the Draft pill", () => {
    renderPage(draft());

    expect(text()).toContain("Order #22");
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(text()).toContain("Order lines");
    expect(document.querySelectorAll('[data-test-id="draft-order-line"]')).toHaveLength(1);
    expect(text()).toContain("S-1");
    expect(text()).toContain("Products were added to the order");
    expect(text()).toContain("2 × Shirt (M)");
    // A draft has nothing to mark as paid.
    expect(byTestId("mark-as-paid-button")).toBeNull();
  });

  it("adds, changes and removes lines, finalizes and deletes", () => {
    const props = renderPage(draft());

    byTestId("add-products-button")?.click();
    expect(props.onOrderLineAdd).toHaveBeenCalled();

    const input =
      byTestId("line-quantity-input")?.querySelector("input") ??
      (byTestId("line-quantity-input") as HTMLInputElement | null);
    if (!input) throw new Error("no quantity input");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);
    expect(props.onOrderLineChange).toHaveBeenCalledWith("l1", 5);
    // An unchanged or empty value saves nothing.
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(props.onOrderLineChange).toHaveBeenCalledTimes(1);

    byTestId("remove-line-button")?.click();
    expect(props.onOrderLineRemove).toHaveBeenCalledWith("l1");

    byTestId("finalize-button")?.click();
    expect(props.onDraftFinalize).toHaveBeenCalled();
    expect(byTestId("show-more-button")).toBeTruthy();
  });

  it("says when the draft has no lines", () => {
    renderPage(draft({ lines: [] }));

    expect(text()).toContain("No products found");
  });
});
