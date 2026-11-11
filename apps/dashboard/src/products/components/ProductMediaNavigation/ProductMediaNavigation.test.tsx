// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ProductMediaNavigation } from "./ProductMediaNavigation";

afterEach(cleanup);

const media = [
  { id: "media-1", url: "https://example.com/1.webp", alt: "Front" },
  { id: "media-2", url: "https://example.com/2.webp", alt: "Back" },
  { id: "media-3", url: "https://example.com/3.webp", alt: "" },
];

const renderNavigation = (
  props: Partial<Parameters<typeof ProductMediaNavigation>[0]> = {},
): ReturnType<typeof vi.fn> => {
  const onRowClick = vi.fn(() => vi.fn());

  render(
    <LocaleProvider>
      <ProductMediaNavigation media={media} onRowClick={onRowClick} {...props} />
    </LocaleProvider>,
  );

  return onRowClick;
};

const item = (mediaId: string) => {
  const element = document.querySelector<HTMLElement>(
    `[data-test-id="product-media-navigation-item"][data-media-id="${mediaId}"]`,
  );
  if (!element) throw new Error(`no tile for ${mediaId}`);
  return element;
};

describe("ProductMediaNavigation", () => {
  it("lists the product's images as thumbnails", () => {
    renderNavigation();

    expect(screen.getByText("All Media")).toBeTruthy();
    expect(
      document.querySelectorAll('[data-test-id="product-media-navigation-item"]'),
    ).toHaveLength(3);
    expect(item("media-1").querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/1.webp",
    );
    expect(item("media-1").querySelector("img")?.getAttribute("alt")).toBe("Front");
  });

  it("highlights the image open in the URL", () => {
    renderNavigation({ highlighted: "media-2" });

    expect(item("media-2").getAttribute("aria-current")).toBe("page");
    expect(item("media-1").getAttribute("aria-current")).toBeNull();
  });

  it("opens the clicked image's page through onRowClick", () => {
    const onRowClick = renderNavigation();

    fireEvent.click(item("media-2"));

    expect(onRowClick).toHaveBeenCalledWith("media-2");
    expect(onRowClick.mock.results[0]?.value).toBeInstanceOf(Function);
  });

  it("shows placeholder tiles until the media resolve", () => {
    render(
      <LocaleProvider>
        <ProductMediaNavigation media={undefined} onRowClick={() => () => undefined} />
      </LocaleProvider>,
    );

    expect(
      document.querySelector('[data-test-id="product-media-navigation-skeleton"]'),
    ).toBeTruthy();
  });
});
