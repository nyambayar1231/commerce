// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { WarehouseFragment } from "../../../graphql/types.generated";
import type { ProductVariantStock } from "../ProductVariantPage/form";
import { ProductStocks } from "./ProductStocks";

afterEach(cleanup);

const warehouse = (id: string, name: string): WarehouseFragment => ({
  __typename: "Warehouse",
  id,
  name,
});

const stock = (overrides: Partial<ProductVariantStock> = {}): ProductVariantStock => ({
  warehouseId: "w1",
  warehouseName: "Main warehouse",
  quantityAllocated: 4,
  quantity: "12",
  ...overrides,
});

const warehouses = [warehouse("w1", "Main warehouse"), warehouse("w2", "Returns")];

const renderCard = (props: Partial<Parameters<typeof ProductStocks>[0]> = {}) => {
  const handlers = {
    onChange: vi.fn(),
    onTrackInventoryChange: vi.fn(),
    onStockChange: vi.fn(),
    onStockAdd: vi.fn(),
    onStockDelete: vi.fn(),
  };

  render(
    <LocaleProvider>
      <ProductStocks
        data={{ sku: "BT-39", trackInventory: true }}
        stocks={[stock()]}
        warehouses={warehouses}
        disabled={false}
        errors={[]}
        {...handlers}
        {...props}
      />
    </LocaleProvider>,
  );

  return handlers;
};

const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`no element with data-test-id="${id}"`);
  return element;
};

describe("ProductStocks", () => {
  it("renders one row per warehouse with its allocated and typed quantity", () => {
    renderCard({
      stocks: [
        stock(),
        stock({
          warehouseId: "w2",
          warehouseName: "Returns",
          quantityAllocated: 0,
          quantity: "3",
        }),
      ],
    });

    expect(screen.getByText("Stock")).toBeTruthy();
    expect(byTestId("product-variant-stock-list")).toBeTruthy();

    const rows = document.querySelectorAll('[data-test-id="stock-input"]');
    expect(rows).toHaveLength(2);
    expect((rows[0] as HTMLInputElement).value).toBe("12");
    expect((rows[1] as HTMLInputElement).value).toBe("3");

    const mainRow = byTestId<HTMLElement>("Main warehouse");
    expect(within(mainRow).getByText("Main warehouse")).toBeTruthy();
    expect(within(mainRow).getByText("4")).toBeTruthy();
  });

  it("reports changes to a stock quantity from its row's input", () => {
    const { onStockChange } = renderCard();

    fireEvent.change(byTestId<HTMLInputElement>("stock-input"), { target: { value: "7" } });

    expect(onStockChange).toHaveBeenCalledWith("w1", "7");
  });

  it("deletes a row's stock through its trash button", () => {
    const { onStockDelete } = renderCard();

    fireEvent.click(within(byTestId<HTMLElement>("Main warehouse")).getByRole("button"));

    expect(onStockDelete).toHaveBeenCalledWith("w1");
  });

  it("shows Saleor's empty-state sentence when the variant has no stock rows", () => {
    renderCard({ stocks: [] });

    expect(screen.getByText(/There are no warehouses set up for this variant/)).toBeTruthy();
    expect(screen.getByText(/configure a warehouse/)).toBeTruthy();
    expect(document.querySelector('[data-test-id="product-variant-stock-list"]')).toBeNull();
    expect(byTestId("assign-warehouse-button")).toBeTruthy();
  });

  it("opens the Assign Warehouses dialog with the warehouses the variant has no stock in", async () => {
    renderCard();

    fireEvent.click(byTestId("assign-warehouse-button"));

    await waitFor(() => expect(byTestId("assign-and-save-button")).toBeTruthy());

    // The card's own "Assign Warehouses" button and the dialog's title.
    expect(screen.getAllByText("Assign Warehouses")).toHaveLength(2);
    // "Main warehouse" is only the stock row: the dialog excludes the already-stocked warehouse.
    expect(screen.getAllByText("Main warehouse")).toHaveLength(1);
    // The Track Inventory checkbox plus the dialog's single (Returns) checkbox: the role query
    // ignores the aria-hidden card while the modal is open, so count them in the DOM.
    expect(document.querySelectorAll('[role="checkbox"]')).toHaveLength(2);
    expect(byTestId<HTMLElement>("Main warehouse").querySelector('[role="checkbox"]')).toBeNull();
    expect(within(byTestId<HTMLElement>("Returns")).getByRole("checkbox")).toBeTruthy();
  });
});
