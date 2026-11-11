// Adapted from saleor-dashboard: src/products/components/ProductListTiles/ProductListTiles.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// @vitest-environment jsdom
import { cleanup, configure, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductListRowFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { ProductListTiles } from "./ProductListTiles";

configure({ testIdAttribute: "data-test-id" });

// The pagination has its own test and needs a router; the tile grid is what is under test here.
vi.mock("../../../components/TablePagination/DatagridPagination", () => ({
  DatagridPagination: () => null,
}));

afterEach(cleanup);

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
  thumbnail: null,
  ...overrides,
});

describe("ProductListTiles", () => {
  it("uses the same empty placeholder as the list view", () => {
    render(
      <LocaleProvider>
        <ProductListTiles
          rows={[]}
          disabled={false}
          settings={{ rowNumber: 20 }}
          onTileClick={() => undefined}
          onUpdateListSettings={() => undefined}
        />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("empty-data-grid-text").textContent).toBe("No products found");
  });

  it("renders a tile per product", () => {
    render(
      <ThemeProvider>
        <LocaleProvider>
          <ProductListTiles
            rows={[product(), product({ id: "p2", name: "Other" })]}
            disabled={false}
            settings={{ rowNumber: 20 }}
            onTileClick={() => undefined}
            onUpdateListSettings={() => undefined}
          />
        </LocaleProvider>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("tile-view")).toBeTruthy();
    expect(screen.getByTestId("product-tile-p1")).toBeTruthy();
    expect(screen.getByTestId("product-tile-p2")).toBeTruthy();
  });
});
