// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { ProductAvailabilityCard } from "./ProductAvailabilityCard";

afterEach(cleanup);

const renderCard = (
  props: Partial<Parameters<typeof ProductAvailabilityCard>[0]> = {},
  onChange = vi.fn(),
) => {
  render(
    <LocaleProvider>
      <ProductAvailabilityCard
        isPublished
        publishedAt="2026-02-03T10:00:00Z"
        disabled={false}
        errors={[]}
        onChange={onChange}
        {...props}
      />
    </LocaleProvider>,
  );

  return onChange;
};

const toggle = () => document.querySelector<HTMLButtonElement>('[data-test-id="published-toggle"]');

describe("ProductAvailabilityCard", () => {
  it("shows the published state with the publication date", () => {
    renderCard();

    const expectedDate = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
      new Date("2026-02-03T10:00:00Z"),
    );

    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.getByText(`since ${expectedDate}`)).toBeTruthy();
    expect(toggle()?.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the hidden state and toggles the publish flag", () => {
    const onChange = renderCard({ isPublished: false, publishedAt: null });

    expect(screen.getByText("Hidden from public API.")).toBeTruthy();
    expect(screen.getByText(/Customers cannot find or view this product\./)).toBeTruthy();
    expect(toggle()?.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle() as HTMLButtonElement);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows the API's publish error on the card", () => {
    const error: ProductErrorFragment = {
      __typename: "ProductError",
      code: "PRODUCT_WITHOUT_VARIANTS",
      field: "isPublished",
      message: "You must add at least one variant to be able to publish.",
    };
    renderCard({
      errors: [error],
    });

    expect(
      screen.getByText("You must add at least one variant to be able to publish."),
    ).toBeTruthy();
  });

  it("shows the error even when the product is not published", () => {
    const error: ProductErrorFragment = {
      __typename: "ProductError",
      code: "PRODUCT_WITHOUT_CATEGORY",
      field: "isPublished",
      message: "You must select a category to be able to publish.",
    };
    renderCard({ isPublished: false, publishedAt: null, errors: [error] });

    expect(screen.getByText("You must select a category to be able to publish.")).toBeTruthy();
  });
});
