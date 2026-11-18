// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductMediaFragment } from "../../../graphql/types.generated";
import { ProductVariantMedia } from "./ProductVariantMedia";

afterEach(cleanup);

const image = (id: string, sortOrder: number): ProductMediaFragment => ({
  __typename: "ProductMedia",
  id,
  alt: id,
  sortOrder,
  type: "IMAGE",
  url: `https://example.com/${id}.png`,
  oembedData: {},
});

const byTestId = <T extends Element>(id: string): T | null =>
  document.querySelector<T>(`[data-test-id="${id}"]`);

const renderCard = (props: Partial<Parameters<typeof ProductVariantMedia>[0]> = {}) => {
  const onImageAdd = vi.fn();

  render(
    <LocaleProvider>
      <ProductVariantMedia media={[]} disabled={false} onImageAdd={onImageAdd} {...props} />
    </LocaleProvider>,
  );

  return { onImageAdd };
};

describe("ProductVariantMedia", () => {
  it("shows the card header, the Choose photos button and the empty message", () => {
    const { onImageAdd } = renderCard();

    expect(screen.getByText("Media")).toBeTruthy();
    expect(screen.getByText("No photos chosen for this variant.")).toBeTruthy();

    const button = byTestId<HTMLButtonElement>("choose-media-button");
    expect(button?.textContent).toContain("Choose photos");
    expect(button?.disabled).toBe(false);

    button?.click();
    expect(onImageAdd).toHaveBeenCalledTimes(1);
  });

  it("shows a tile per chosen image", () => {
    renderCard({ media: [image("media-1", 0), image("media-2", 1)] });

    expect(document.querySelectorAll('[data-test-id="product-image"]')).toHaveLength(2);
    expect(screen.queryByText("No photos chosen for this variant.")).toBeNull();
  });

  it("disables the button when the product has no media to choose from", () => {
    renderCard({ disabled: true });

    expect(byTestId<HTMLButtonElement>("choose-media-button")?.disabled).toBe(true);
  });
});
