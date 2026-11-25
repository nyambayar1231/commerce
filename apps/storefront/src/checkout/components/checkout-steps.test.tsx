// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

let pathname = "/checkout";
let step: string | null = "shipping";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(step === null ? "" : `step=${step}`),
}));

const { CheckoutSteps } = await import("./checkout-steps");

afterEach(cleanup);

describe("CheckoutSteps", () => {
  it("marks the current step, links the earlier ones and not the later ones", () => {
    pathname = "/checkout";
    step = "shipping";
    render(<CheckoutSteps variant="desktop" />);
    const current = document.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain("shipping");
    expect(screen.getByText("contact").closest("a")?.getAttribute("href")).toBe(
      "/checkout?step=contact",
    );
    expect(screen.getByText("payment").closest("a")).toBeNull();
  });

  it("starts at the first step for a missing or unknown step", () => {
    pathname = "/checkout";
    for (const value of [null, "confirm"]) {
      step = value;
      render(<CheckoutSteps variant="mobile" />);
      expect(screen.getByText('stepOf:{"step":1,"total":3}')).toBeTruthy();
      cleanup();
    }
  });

  it("shows nothing outside /checkout (the order page)", () => {
    pathname = "/order/abc";
    const { container } = render(<CheckoutSteps variant="desktop" />);
    expect(container.innerHTML).toBe("");
  });
});
