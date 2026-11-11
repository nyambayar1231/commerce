// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ProductListPage } from "./ProductListPage";

// The toolbar behaviour only: the filters panel and the Glide grid need their own providers and
// hooks, so they are stubbed and the list's selection is passed in as the view would be.
vi.mock("../../../components/AppLayout/ListFilters/ListFilters", () => ({
  ListFilters: ({ actions }: { actions?: ReactNode }) => (
    <div data-test-id="filters">{actions}</div>
  ),
}));
vi.mock("../ProductListDatagrid/ProductListDatagrid", () => ({
  ProductListDatagrid: () => <div data-test-id="datagrid" />,
}));
vi.mock("../ProductListTiles/ProductListTiles", () => ({
  ProductListTiles: () => <div data-test-id="tiles" />,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const bulkDeleteButton = () =>
  document.querySelector<HTMLButtonElement>('[data-test-id="bulk-delete-button"]');

const renderPage = (selectedProductIds: string[]) => {
  const onProductsDelete = vi.fn();
  const clearRowSelection = vi.fn();

  render(
    <LocaleProvider>
      <MemoryRouter>
        <ProductListPage
          initialSearch=""
          onSearchChange={() => undefined}
          onAdd={() => undefined}
          selectedProductIds={selectedProductIds}
          onProductsDelete={onProductsDelete}
          clearRowSelection={clearRowSelection}
          rows={[]}
          disabled={false}
        />
      </MemoryRouter>
    </LocaleProvider>,
  );

  return { onProductsDelete, clearRowSelection };
};

describe("ProductListPage view switch", () => {
  it("renders the datagrid by default", () => {
    renderPage([]);

    expect(document.querySelector('[data-test-id="datagrid"]')).toBeTruthy();
    expect(document.querySelector('[data-test-id="tiles"]')).toBeNull();
  });

  it("renders tiles when the stored view type is tile", () => {
    localStorage.setItem("productListViewType", "tile");

    renderPage([]);

    expect(document.querySelector('[data-test-id="tiles"]')).toBeTruthy();
    expect(document.querySelector('[data-test-id="datagrid"]')).toBeNull();
  });

  it("clears the row selection when the view changes", () => {
    const { clearRowSelection } = renderPage(["p1"]);

    fireEvent.click(document.querySelector('[data-test-id="tile-view-button"]') as HTMLElement);

    expect(clearRowSelection).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("productListViewType")).toBe("tile");
  });
});

describe("ProductListPage bulk delete", () => {
  it("shows no bulk delete button without a selection", () => {
    renderPage([]);

    expect(bulkDeleteButton()).toBeNull();
  });

  it("shows Saleor's delete button with the selected count and opens the dialog", () => {
    const { onProductsDelete } = renderPage(["p1", "p2"]);
    const button = bulkDeleteButton();

    expect(button?.textContent).toContain("Delete products");
    expect(button?.textContent).toContain("2");

    if (button) fireEvent.click(button);
    expect(onProductsDelete).toHaveBeenCalledTimes(1);
  });
});
