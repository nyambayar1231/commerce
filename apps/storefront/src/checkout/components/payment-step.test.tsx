// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaceOrderState } from "../types";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const { PaymentStep } = await import("./payment-step");

afterEach(cleanup);

const ATTEMPT = "11111111-2222-4333-8444-555555555555";
const countries = [{ code: "MN", name: "Монгол" }];

function setup(
  action = vi.fn(async (): Promise<PlaceOrderState> => ({ status: "idle" })),
  ids = ["dummy"],
) {
  const { container } = render(
    <PaymentStep attemptId={ATTEMPT} providerIds={ids} countries={countries} placeOrder={action} />,
  );
  return { action, container };
}

const hidden = (container: HTMLElement, name: string) =>
  (container.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value;

describe("PaymentStep", () => {
  it("posts the server's attempt id and the provider id, billing 'same as shipping' by default", async () => {
    const { action, container } = setup();
    expect(hidden(container, "attemptId")).toBe(ATTEMPT);
    expect(hidden(container, "providerId")).toBe("dummy");
    expect(screen.getByText("checkout.payment.testNotice", { exact: false })).toBeTruthy();
    expect(
      (screen.getByLabelText("checkout.payment.sameAsShipping") as HTMLInputElement).checked,
    ).toBe(true);
    expect(container.querySelector('input[name="firstName"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "checkout.payment.placeOrder" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const data = (action.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("attemptId")).toBe(ATTEMPT);
    expect(data.get("billingSameAsShipping")).toBe("true");
  });

  it("shows the billing address fields when 'same as shipping' is unticked and blocks an incomplete one", async () => {
    const { action, container } = setup();
    fireEvent.click(screen.getByLabelText("checkout.payment.sameAsShipping"));
    expect(container.querySelector('input[name="firstName"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "checkout.payment.placeOrder" }));
    expect((await screen.findAllByText("errors.required")).length).toBeGreaterThan(0);
    expect(action).not.toHaveBeenCalled();
  });

  it("uses the new attempt id the action hands back when the old one is spent", async () => {
    const next = "99999999-2222-4333-8444-555555555555";
    const action = vi.fn(
      async (): Promise<PlaceOrderState> => ({
        status: "error",
        message: "paymentDeclined",
        nextAttemptId: next,
      }),
    );
    const { container } = setup(action);
    fireEvent.click(screen.getByRole("button", { name: "checkout.payment.placeOrder" }));
    expect(await screen.findByText("checkout.errors.paymentDeclined")).toBeTruthy();
    await waitFor(() => expect(hidden(container, "attemptId")).toBe(next));
  });

  it("offers no way to pay when no provider is enabled", () => {
    const { container } = setup(undefined, []);
    expect(screen.getByText("checkout.payment.noProviders")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
  });

  it("links the cart from a message that is fixed there", async () => {
    const action = vi.fn(
      async (): Promise<PlaceOrderState> => ({ status: "error", message: "insufficientStock" }),
    );
    setup(action);
    fireEvent.click(screen.getByRole("button", { name: "checkout.payment.placeOrder" }));
    const link = await screen.findByText("checkout.errors.goToCart");
    expect(link.closest("a")?.getAttribute("href")).toBe("/cart");
  });
});
