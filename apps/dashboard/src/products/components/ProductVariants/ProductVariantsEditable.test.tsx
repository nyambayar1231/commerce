// @vitest-environment jsdom
// The editable Variants grid's wiring: Glide needs a canvas and its own measurement hooks in a
// browser, so the component test replaces the Datagrid with a stub that calls the same
// getCellContent/getCellError/menuItems props the real grid uses and renders what they return.

import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductDetailsFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { ProductVariants } from "./ProductVariants";

interface StubDatagridProps {
  availableColumns: { id: string }[];
  rows: number;
  fillHandle?: boolean;
  getCellContent: (
    item: [number, number],
    opts: {
      changes: { current: never[] };
      getChangeIndex: () => number;
    },
  ) => {
    data: string | number | { value: unknown } | symbol;
    readonly?: boolean;
    allowOverlay?: boolean;
  };
  getCellError?: (
    item: [number, number],
    opts: {
      changes: { current: never[] };
      getChangeIndex: () => number;
    },
  ) => boolean;
  menuItems?: (index: number) => { label: string; testId?: string; onSelect: () => void }[];
}

const cellText = (data: unknown): string => {
  if (typeof data === "string" || typeof data === "number") {
    return String(data);
  }

  if (typeof data === "symbol") {
    return "";
  }

  return data !== null && typeof data === "object" && "value" in data ? String(data.value) : "";
};

vi.mock("../../../components/Datagrid/Datagrid", () => ({
  Datagrid: (props: StubDatagridProps): ReactElement => {
    const opts = { changes: { current: [] }, getChangeIndex: () => -1 };
    const cells = [];
    const actions = [];

    for (let row = 0; row < props.rows; row += 1) {
      for (let column = 0; column < props.availableColumns.length; column += 1) {
        const item: [number, number] = [column, row];
        const cell = props.getCellContent(item, opts);
        const columnId = props.availableColumns[column]?.id ?? "";

        cells.push(
          <div
            key={`${columnId}-${row}`}
            data-test-id={`cell-${columnId}-${row}`}
            data-editable={cell.readonly === false && cell.allowOverlay === true ? "true" : "false"}
            data-error={props.getCellError?.(item, opts) ? "true" : "false"}
          >
            {cellText(cell.data)}
          </div>,
        );
      }

      for (const action of props.menuItems?.(row) ?? []) {
        actions.push(
          <button
            key={`${action.testId}-${row}`}
            type="button"
            data-test-id={`${action.testId}-${row}`}
            onClick={() => action.onSelect()}
          >
            {action.label}
          </button>,
        );
      }
    }

    return (
      <div data-test-id="datagrid" data-fill-handle={props.fillHandle ? "true" : "false"}>
        {cells}
        {actions}
      </div>
    );
  },
}));

afterEach(cleanup);

const variants: ProductDetailsFragment["variants"] = [
  {
    __typename: "ProductVariant",
    id: "v1",
    name: "Size 39",
    sku: "BT-39",
    price: { __typename: "Money", amount: 15000, currency: "MNT" },
    stocks: [
      {
        __typename: "Stock",
        id: "s1",
        quantity: 5,
        warehouse: { __typename: "Warehouse", id: "w1" },
      },
    ],
  },
  {
    __typename: "ProductVariant",
    id: "v2",
    name: "Size 40",
    sku: "BT-40",
    price: { __typename: "Money", amount: 16000, currency: "MNT" },
    stocks: [],
  },
];

const renderGrid = (
  props: Partial<{
    errors: { variantId: string; columnId: string }[];
    onRowClick: (variantId: string) => void;
  }> = {},
) => {
  const onRowClick = props.onRowClick ?? vi.fn();

  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter>
          <ProductVariants
            variants={variants}
            warehouses={[{ id: "w1", name: "Main warehouse" }]}
            errors={props.errors ?? []}
            onAddVariant={vi.fn()}
            onRowClick={onRowClick}
            onChange={vi.fn()}
          />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );

  return { onRowClick };
};

const cell = (testId: string) => document.querySelector<HTMLElement>(`[data-test-id="${testId}"]`);

describe("ProductVariants editable grid", () => {
  it("renders the editable cells of each row, with the fill handle on", () => {
    renderGrid();

    expect(cell("datagrid")?.dataset.fillHandle).toBe("true");
    expect(cell("cell-name-0")?.textContent).toBe("Size 39");
    expect(cell("cell-sku-0")?.textContent).toBe("BT-39");
    expect(cell("cell-price-0")?.textContent).toBe("15000");
    expect(cell("cell-warehouse:w1-0")?.textContent).toBe("5");
    expect(cell("cell-name-1")?.textContent).toBe("Size 40");

    expect(cell("cell-name-0")?.dataset.editable).toBe("true");
    expect(cell("cell-sku-0")?.dataset.editable).toBe("true");
    expect(cell("cell-price-0")?.dataset.editable).toBe("true");
    expect(cell("cell-warehouse:w1-0")?.dataset.editable).toBe("true");
    expect(cell("cell-name-0")?.dataset.error).toBe("false");
  });

  it("shows a rejected row's errors as red cells, on their own columns only", () => {
    renderGrid({
      errors: [
        { variantId: "v1", columnId: "sku" },
        { variantId: "v1", columnId: "warehouse:w1" },
      ],
    });

    expect(cell("cell-sku-0")?.dataset.error).toBe("true");
    expect(cell("cell-warehouse:w1-0")?.dataset.error).toBe("true");
    expect(cell("cell-name-0")?.dataset.error).toBe("false");
    expect(cell("cell-price-0")?.dataset.error).toBe("false");
    expect(cell("cell-sku-1")?.dataset.error).toBe("false");
  });

  it("opens a variant page from the row's pencil", () => {
    const { onRowClick } = renderGrid();

    expect(cell("edit-variant-0")?.textContent).toBe("Edit variant");

    fireEvent.click(cell("edit-variant-1") as HTMLElement);

    expect(onRowClick).toHaveBeenCalledWith("v2");
  });
});
