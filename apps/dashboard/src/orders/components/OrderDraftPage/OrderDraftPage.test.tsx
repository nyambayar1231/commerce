// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { SavebarRefProvider, useSavebarRef } from "../../../components/Savebar/SavebarRefContext";
import type { OrderDetailsFragment, OrderErrorFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { OrderDraftPage } from "./OrderDraftPage";

afterEach(cleanup);

// The canvas grid needs a real browser (the golden path edits it); the page around it is tested
// here, with buttons standing in for the grid's quantity edit and "Remove product".
vi.mock("../OrderDraftDetailsDatagrid/OrderDraftDetailsDatagrid", () => ({
  OrderDraftDetailsDatagrid: ({
    lines,
    errors,
    onOrderLineChange,
    onOrderLineRemove,
  }: {
    lines: { id: string; productSku: string }[];
    errors: unknown[];
    onOrderLineChange: (id: string, quantity: number) => void;
    onOrderLineRemove: (id: string) => void;
  }) => (
    <div data-test-id="lines-grid" data-errors={errors.length}>
      {lines.map((line) => (
        <span key={line.id} data-test-id="draft-order-line">
          {line.productSku}
        </span>
      ))}
      <button type="button" data-test-id="change-line" onClick={() => onOrderLineChange("l1", 5)} />
      <button type="button" data-test-id="remove-line" onClick={() => onOrderLineRemove("l1")} />
    </div>
  ),
}));

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

const renderPage = (order?: OrderDetailsFragment, errors: OrderErrorFragment[] = []) => {
  const props = {
    disabled: false,
    finalizeState: "default" as const,
    onBack: vi.fn(),
    onDraftFinalize: vi.fn(),
    onDraftRemove: vi.fn(),
    onOrderLineAdd: vi.fn(),
    onOrderLineChange: vi.fn(),
    onOrderLineRemove: vi.fn(),
    onCustomerChange: vi.fn(),
    errors,
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

    byTestId("change-line")?.click();
    expect(props.onOrderLineChange).toHaveBeenCalledWith("l1", 5);
    byTestId("remove-line")?.click();
    expect(props.onOrderLineRemove).toHaveBeenCalledWith("l1");

    byTestId("finalize-button")?.click();
    expect(props.onDraftFinalize).toHaveBeenCalled();
    expect(byTestId("show-more-button")).toBeTruthy();
  });

  it("shows no shipping, tax or addresses, and edits the customer", () => {
    renderPage(draft());

    expect(text()).not.toContain("Shipping");
    expect(text()).not.toContain("Taxes");
    expect(text()).not.toContain("Billing address");
    expect(byTestId("shipping-address-section")).toBeNull();
    expect(byTestId("billing-address-section")).toBeNull();
    expect(byTestId("change-customer")).toBeTruthy();
  });

  it("marks what Finalize says is missing in red, next to its field", () => {
    const error = (
      field: string,
      code: OrderErrorFragment["code"],
      orderLines: string[] | null = null,
    ) => ({
      __typename: "OrderError" as const,
      field,
      code,
      message: "API message",
      orderLines,
      warehouse: null,
      addressType: null,
    });
    renderPage(draft(), [
      error("userEmail", "REQUIRED"),
      error("lines", "NOT_FOUND"),
      error("lines", "INSUFFICIENT_STOCK", ["l1"]),
    ]);

    expect(byTestId("customer-error")?.textContent).toBe(
      "Choose a customer or type their email before finalizing.",
    );
    // A line's own error goes to its status cell, the rest above the grid.
    expect(byTestId("lines-grid")?.getAttribute("data-errors")).toBe("1");
    expect(byTestId("lines-errors")?.textContent).not.toContain("insufficient stock");
    expect(byTestId("lines-errors")?.textContent?.length).toBeGreaterThan(0);
  });

  it("says when the draft has no lines", () => {
    renderPage(draft({ lines: [] }));

    expect(text()).toContain("No products found");
  });
});
