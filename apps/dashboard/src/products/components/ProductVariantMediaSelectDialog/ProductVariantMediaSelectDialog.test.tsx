// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductMediaFragment } from "../../../graphql/types.generated";
import { ProductVariantMediaSelectDialog } from "./ProductVariantMediaSelectDialog";

afterEach(cleanup);

const image = (id: string, sortOrder: number): ProductMediaFragment => ({
  __typename: "ProductMedia",
  id,
  alt: `Image ${id}`,
  sortOrder,
  type: "IMAGE",
  url: `https://example.com/${id}.png`,
  oembedData: {},
});

const media = [image("media-2", 1), image("media-1", 0)];

const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`no element with data-test-id="${id}"`);
  return element;
};

const mediaOptions = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-test-id="variant-media-option"]'));

const renderDialog = (
  props: Partial<Parameters<typeof ProductVariantMediaSelectDialog>[0]> = {},
) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <LocaleProvider>
      <ProductVariantMediaSelectDialog
        open
        media={media}
        selectedMedia={["media-1"]}
        onConfirm={onConfirm}
        onClose={onClose}
        {...props}
      />
    </LocaleProvider>,
  );

  return { onConfirm, onClose };
};

describe("ProductVariantMediaSelectDialog", () => {
  it("shows the product's images as tiles in their gallery order", () => {
    renderDialog();

    expect(screen.getByText("Choose variant photos")).toBeTruthy();

    const tiles = mediaOptions();
    expect(tiles).toHaveLength(2);
    expect(tiles[0]?.querySelector("img")?.getAttribute("alt")).toBe("Image media-1");
    expect(tiles[1]?.querySelector("img")?.getAttribute("alt")).toBe("Image media-2");
    expect(tiles[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(tiles[1]?.getAttribute("aria-pressed")).toBe("false");
  });

  it("disables Confirm until the selection changes", () => {
    renderDialog();

    expect(byTestId<HTMLButtonElement>("submit").disabled).toBe(true);

    fireEvent.click(mediaOptions()[1] as HTMLElement);

    expect(byTestId<HTMLButtonElement>("submit").disabled).toBe(false);
  });

  it("toggles a chosen image off", () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(mediaOptions()[0] as HTMLElement);
    fireEvent.click(byTestId("submit"));

    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("confirms the selection and closes", () => {
    const { onConfirm, onClose } = renderDialog();

    fireEvent.click(mediaOptions()[1] as HTMLElement);
    fireEvent.click(byTestId("submit"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(["media-1", "media-2"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the saved selection when cancelled", () => {
    const { onConfirm, onClose } = renderDialog();

    fireEvent.click(mediaOptions()[1] as HTMLElement);
    fireEvent.click(byTestId("back"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says there is nothing to choose when the product has no media", () => {
    renderDialog({ media: [], selectedMedia: [] });

    expect(screen.getByText(/No product media available/)).toBeTruthy();
    expect(mediaOptions()).toHaveLength(0);
  });
});
