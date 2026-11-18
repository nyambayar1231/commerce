// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ProductVariantNavigation } from "./ProductVariantNavigation";

afterEach(cleanup);

const variants = [
  {
    id: "variant-1",
    name: "Size 39",
    sku: "BT-39",
    media: [{ id: "media-1", url: "https://example.com/size-39.png" }],
  },
  { id: "variant-2", name: "", sku: "BT-40", media: [] },
  { id: "variant-3", name: "Size 41", sku: null },
];

const renderNavigation = (props: Partial<Parameters<typeof ProductVariantNavigation>[0]> = {}) =>
  render(
    <LocaleProvider>
      <MemoryRouter>
        <ProductVariantNavigation productId="product-1" variants={variants} {...props} />
      </MemoryRouter>
    </LocaleProvider>,
  );

const row = (variantId: string) => {
  const element = document.querySelector<HTMLElement>(
    `[data-test-id="variant-row"][data-variant-id="${variantId}"]`,
  );
  if (!element) throw new Error(`no row for ${variantId}`);
  return element;
};

describe("ProductVariantNavigation", () => {
  it("lists the variants, using the SKU when a variant has no name", () => {
    renderNavigation();

    expect(screen.getByText("Variants")).toBeTruthy();
    expect(screen.getByText("Size 39")).toBeTruthy();
    expect(screen.getByText("BT-40")).toBeTruthy();
    expect(screen.getByText("Size 41")).toBeTruthy();
  });

  it("highlights the variant open in the URL and links each row to its page", () => {
    renderNavigation({ current: "variant-2" });

    expect(row("variant-2").getAttribute("aria-current")).toBe("page");
    expect(row("variant-1").getAttribute("aria-current")).toBeNull();

    const link = row("variant-1").closest("a");
    expect(link?.getAttribute("href")).toBe("/products/variant/variant-1");
  });

  it("shows each variant's first image, or a placeholder when it has none", () => {
    renderNavigation();

    const thumbnail = row("variant-1").querySelector<HTMLImageElement>(
      '[data-test-id="variant-thumbnail"]',
    );
    expect(thumbnail?.getAttribute("src")).toBe("https://example.com/size-39.png");
    expect(thumbnail?.getAttribute("alt")).toBe("Size 39");

    expect(
      row("variant-2").querySelector('[data-test-id="variant-thumbnail-placeholder"]'),
    ).not.toBeNull();
    expect(row("variant-2").querySelector('[data-test-id="variant-thumbnail"]')).toBeNull();

    // The create page's siblings come from a query without media: a placeholder, not a crash.
    expect(
      row("variant-3").querySelector('[data-test-id="variant-thumbnail-placeholder"]'),
    ).not.toBeNull();
  });

  it("links to the add page and hides it on the create page", () => {
    renderNavigation({ current: "variant-1" });

    const addLink = screen.getByText("Add variant").closest("a");
    expect(addLink?.getAttribute("href")).toBe("/products/product-1/variant/add");

    cleanup();
    renderNavigation({ isCreate: true });
    expect(screen.queryByText("Add variant")).toBeNull();
  });
});
