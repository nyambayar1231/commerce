// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { SavebarRefProvider, useSavebarRef } from "../../../components/Savebar/SavebarRefContext";
import type { CustomerDetailsQuery } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { CustomerDetailsPage, hasCustomerChanges } from "./CustomerDetailsPage";

afterEach(cleanup);

type Customer = NonNullable<CustomerDetailsQuery["user"]>;

const money = (amount: number) => ({ __typename: "Money" as const, amount, currency: "MNT" });

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  __typename: "User",
  id: "VXNlcjox",
  email: "bat@example.com",
  firstName: "Bat",
  lastName: "Dorj",
  dateJoined: "2026-11-01T10:00:00Z",
  lastLogin: "2026-11-12T08:30:00Z",
  isActive: true,
  isStaff: false,
  orders: {
    __typename: "OrderCountableConnection",
    totalCount: 1,
    edges: [
      {
        __typename: "OrderCountableEdge",
        node: {
          __typename: "Order",
          id: "T3JkZXI6MQ==",
          created: "2026-11-10T12:00:00Z",
          number: "7",
          status: "FULFILLED",
          total: { __typename: "TaxedMoney", gross: money(35000) },
        },
      },
    ],
  },
  kpiOrders: {
    __typename: "OrderCountableConnection",
    edges: [
      {
        __typename: "OrderCountableEdge",
        node: {
          __typename: "Order",
          id: "T3JkZXI6MQ==",
          status: "FULFILLED",
          created: "2026-11-10T12:00:00Z",
          subtotal: { __typename: "TaxedMoney", net: money(30000) },
          shippingPrice: { __typename: "TaxedMoney", gross: money(5000) },
          totalRefunded: money(0),
        },
      },
    ],
  },
  kpiNonCancelledOrderCount: { __typename: "OrderCountableConnection", totalCount: 1 },
  ...overrides,
});

// The app's layout gives the Savebar its portal target; here a plain div does.
const SavebarAnchor = () => {
  const { setAnchor } = useSavebarRef();

  return <div ref={setAnchor} />;
};

const byTestId = (id: string) => document.querySelector(`[data-test-id="${id}"]`);

const renderPage = (
  props: Partial<Parameters<typeof CustomerDetailsPage>[0]> = {},
): { onSubmit: ReturnType<typeof vi.fn> } => {
  const onSubmit = vi.fn(async () => []);

  render(
    <ThemeProvider>
      <LocaleProvider>
        <SavebarRefProvider>
          <SavebarAnchor />
          <MemoryRouter>
            <CustomerDetailsPage
              customer={customer()}
              canEdit
              canReadOrders
              disabled={false}
              errors={[]}
              saveButtonBar="default"
              onSubmit={onSubmit}
              onDelete={vi.fn()}
              onActivateToggle={vi.fn()}
              {...props}
            />
          </MemoryRouter>
        </SavebarRefProvider>
      </LocaleProvider>
    </ThemeProvider>,
  );

  return { onSubmit };
};

describe("CustomerDetailsPage", () => {
  it("shows Saleor's title, KPI tiles, recent orders and contact card", () => {
    renderPage();

    expect(screen.getAllByText("Bat Dorj").length).toBeGreaterThan(0);
    expect(byTestId("account-status-active")).toBeTruthy();
    expect(screen.getByText(/Member since/)).toBeTruthy();
    expect(byTestId("kpi-total-orders")?.textContent).toContain("1");
    expect(byTestId("kpi-recent-spent")?.textContent).toContain("30,000");
    expect(byTestId("kpi-recent-aov")?.textContent).toContain("30,000");
    expect(byTestId("kpi-last-login")).toBeTruthy();
    expect(byTestId("customer-order-row")?.getAttribute("href")).toBe("/orders/T3JkZXI6MQ%3D%3D");
    expect(screen.getByText("View all orders").closest("a")?.getAttribute("href")).toBe(
      "/orders?query=bat%40example.com",
    );
    expect((byTestId("customer-email") as HTMLInputElement | null)?.value).toBe("bat@example.com");
  });

  it("marks inactive customers and staff who placed orders", () => {
    renderPage({ customer: customer({ isActive: false, isStaff: true }) });

    expect(byTestId("account-status-inactive")).toBeTruthy();
    expect(byTestId("customer-staff-badge")).toBeTruthy();
  });

  it("hides the order figures without MANAGE_ORDERS", () => {
    renderPage({ canReadOrders: false });

    expect(byTestId("kpi-total-orders")).toBeNull();
    expect(byTestId("customer-orders")).toBeNull();
    expect(byTestId("kpi-last-login")).toBeTruthy();
  });

  it("is read-only without MANAGE_USERS", () => {
    renderPage({ canEdit: false });

    expect(byTestId("savebar-read-only")).toBeTruthy();
    expect((byTestId("customer-email") as HTMLInputElement | null)?.disabled).toBe(true);
  });

  it("saves the contact details once something changed", () => {
    const { onSubmit } = renderPage();
    const input = byTestId("customer-first-name") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Baatar" } });
    expect(screen.getByText(/Unsaved changes: details/)).toBeTruthy();
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalledWith({
      firstName: "Baatar",
      lastName: "Dorj",
      email: "bat@example.com",
    });
  });
});

describe("hasCustomerChanges", () => {
  it("compares the contact fields", () => {
    const initial = { firstName: "A", lastName: "B", email: "a@b.c" };

    expect(hasCustomerChanges(initial, initial)).toBe(false);
    expect(hasCustomerChanges({ ...initial, email: "x@b.c" }, initial)).toBe(true);
  });
});
