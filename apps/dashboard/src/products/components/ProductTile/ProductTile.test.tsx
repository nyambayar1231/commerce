// Adapted from saleor-dashboard: src/products/components/ProductTile/ProductTile.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductListRowFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { ProductTile } from "./ProductTile";

configure({ testIdAttribute: "data-test-id" });

afterEach(cleanup);

const THUMBNAIL_URL = "https://example.com/thumb.png";

const product = (overrides: Partial<ProductListRowFragment> = {}): ProductListRowFragment => ({
  __typename: "Product",
  id: "p1",
  name: "Prod",
  isPublished: true,
  publishedAt: null,
  minimalVariantPrice: null,
  category: null,
  created: null,
  updatedAt: null,
  thumbnail: { __typename: "Image", url: THUMBNAIL_URL },
  ...overrides,
});

const renderTile = (tileProduct: ProductListRowFragment) => {
  const onClick = vi.fn();

  render(
    <ThemeProvider>
      <LocaleProvider>
        <ProductTile product={tileProduct} onClick={onClick} />
      </LocaleProvider>
    </ThemeProvider>,
  );

  return { onClick };
};

describe("ProductTile", () => {
  it("renders the thumbnail, status label and product name", () => {
    renderTile(product());

    const img = screen.getByAltText("Prod") as HTMLImageElement;

    expect(img.getAttribute("src")).toBe(THUMBNAIL_URL);
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.getByText("Prod")).toBeTruthy();
  });

  it("renders the empty-image placeholder without a thumbnail", () => {
    renderTile(product({ id: "p2", name: "No image", thumbnail: null }));

    expect(screen.getByTestId("placeholder-svg-p2")).toBeTruthy();
    expect(screen.getByText("No image")).toBeTruthy();
  });

  it("shows Saleor's hidden label and error dot status for an unpublished product", () => {
    renderTile(product({ isPublished: false }));

    expect(screen.getByText("Hidden")).toBeTruthy();
  });

  it("fires onClick when the tile is clicked", () => {
    const tileProduct = product();
    const { onClick } = renderTile(tileProduct);

    fireEvent.click(screen.getByTestId(`product-tile-${tileProduct.id}`));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
