// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDetailView } from "@/lib/account/types";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns}.${key}${values ? JSON.stringify(values) : ""}`,
}));
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
      createElement("a", { href, ...rest }, children),
  };
});

const { OrderDetail } = await import("./order-detail");

afterEach(cleanup);

const address = {
  id: "a1",
  firstName: "Бат",
  lastName: "Болд",
  companyName: "",
  streetAddress1: "Энхтайваны өргөн чөлөө 5",
  streetAddress2: "",
  city: "Сүхбаатар дүүрэг",
  cityArea: "1-р хороо",
  postalCode: "",
  countryArea: "Улаанбаатар",
  countryCode: "MN",
  countryName: "Mongolia",
  phone: "",
  isDefaultShipping: false,
  isDefaultBilling: false,
};

const order: OrderDetailView = {
  id: "T3JkZXI6MQ==",
  number: "1042",
  createdIso: "2026-11-20T02:00:00Z",
  createdLabel: "2026 оны 11 сарын 20",
  status: "PARTIALLY_FULFILLED",
  total: "₮ 44,000",
  itemCount: 3,
  paymentState: "full",
  lines: [
    {
      id: "l1",
      productName: "Цүнх",
      variantName: "Улаан",
      quantity: 2,
      unitPrice: "₮ 15,000",
      totalPrice: "₮ 30,000",
    },
  ],
  subtotal: "₮ 39,000",
  shipping: "₮ 5,000",
  shippingMethod: "Хүргэлт",
  shippingAddress: address,
  billingAddress: null,
  timeline: [
    {
      kind: "fulfilled",
      iso: "2026-11-21T03:00:00Z",
      label: "11 сарын 21",
      itemCount: 2,
      trackingNumber: "TRK-1",
    },
    { kind: "placed", iso: "2026-11-20T02:00:00Z", label: "11 сарын 20" },
  ],
};

describe("OrderDetail", () => {
  it("shows number, status, lines, totals, address and the timeline", () => {
    render(<OrderDetail order={order} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("1042");
    expect(screen.getByText("orders.status.PARTIALLY_FULFILLED")).toBeTruthy();
    expect(screen.getByText("Цүнх")).toBeTruthy();
    expect(screen.getAllByText("₮ 30,000").length).toBeGreaterThan(0);
    expect(screen.getByText("₮ 44,000")).toBeTruthy();
    expect(screen.getByText("orders.paymentState.full")).toBeTruthy();
    expect(screen.getByText("Хүргэлт")).toBeTruthy();
    expect(screen.getByText("Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо")).toBeTruthy();
    const steps = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(steps.some((text) => text.includes("timelineEntry.fulfilled"))).toBe(true);
    expect(steps.some((text) => text.includes("TRK-1"))).toBe(true);
    // No billing address: no billing section.
    expect(screen.queryByText("orders.billingAddress")).toBeNull();
  });
});
