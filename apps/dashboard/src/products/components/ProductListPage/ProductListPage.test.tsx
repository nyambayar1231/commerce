// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ProductListPage } from "./ProductListPage";

// The toolbar behaviour only: the filters panel and the Glide grid need their own providers and
// hooks, so they are stubbed and the list's selection is passed in as the view would.
vi.mock("../../../components/AppLayout/ListFilters/ListFilters", () => ({
  ListFilters: ({ actions }: { actions?: ReactNode }) => (
    <div data-test-id="filters">{actions}</div>
  ),
}));
vi.mock("../ProductListDatagrid/ProductListDatagrid", () => ({
  ProductListDatagrid: () => <div data-test-id="datagrid" />,
}));

afterEach(cleanup);

const bulkDeleteButton = () =>
  document.querySelector<HTMLButtonElement>('[data-test-id="bulk-delete-button"]');

const renderPage = (selectedProductIds: string[]) => {
  const onProductsDelete = vi.fn();

  render(
    <LocaleProvider>
      <ProductListPage
        initialSearch=""
        onSearchChange={() => undefined}
        onAdd={() => undefined}
        selectedProductIds={selectedProductIds}
        onProductsDelete={onProductsDelete}
        rows={[]}
        disabled={false}
      />
    </LocaleProvider>,
  );

  return { onProductsDelete };
};

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
