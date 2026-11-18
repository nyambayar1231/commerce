// @vitest-environment jsdom
// A stock cell's edit through the real grid wiring: ProductVariants → Datagrid → useDatagridChange →
// the change list → the cell content and the save input. Glide needs a canvas, so its DataEditor is
// replaced by a stub that keeps the contract our Datagrid relies on: it renders what our
// getCellContent returns (value and theme override) and commits a cell edit with onCellEdited,
// exactly as Glide does for an editor's onChange (a copy of the cell with new data).
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useCallback, useReducer } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DatagridChange,
  DatagridChangeStateContext,
  type OnDatagridChange,
  type UseDatagridChangeState,
  useDatagridChangeState,
} from "../../../components/Datagrid/hooks/useDatagridChange";
import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductDetailsFragment } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { getVariantGridUpdates } from "./datagrid";
import { ProductVariants } from "./ProductVariants";

vi.mock("@glideapps/glide-data-grid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@glideapps/glide-data-grid")>();
  const React = await import("react");

  interface StubCell {
    data?: unknown;
    themeOverride?: { bgCell?: string };
  }

  interface StubProps {
    columns: { id: string }[];
    rows: number;
    getCellContent: (item: [number, number]) => StubCell;
    onCellEdited?: (item: [number, number], cell: StubCell) => void;
  }

  const cellText = (cell: StubCell): string => {
    const data = cell.data as { value?: unknown } | string | undefined;

    if (typeof data === "string") {
      return data;
    }

    const { value } = data ?? {};

    if (typeof value === "symbol") {
      return "-";
    }

    return value === undefined || value === null ? "" : String(value);
  };

  // A typed 7, as the number cell's editor hands it to Glide.
  const withTypedSeven = (cell: StubCell): StubCell => ({
    ...cell,
    data: { ...(cell.data as Record<string, unknown>), value: 7 },
  });

  const StubDataEditor = React.forwardRef(function StubDataEditor(
    { columns, rows, getCellContent, onCellEdited }: StubProps,
    _ref: unknown,
  ) {
    return React.createElement(
      "div",
      { "data-test-id": "stub-grid" },
      Array.from({ length: rows }, (_, row) =>
        Array.from({ length: columns.length }, (_, column) => {
          const item: [number, number] = [column, row];
          const cell = getCellContent(item);
          const id = `${columns[column]?.id ?? ""}-${row}`;

          return React.createElement(
            "div",
            { key: id, "data-test-id": `cell-${id}`, "data-bg": cell.themeOverride?.bgCell ?? "" },
            React.createElement("span", { "data-test-id": `value-${id}` }, cellText(cell)),
            React.createElement(
              "button",
              {
                key: "commit",
                type: "button",
                "data-test-id": `commit-${id}`,
                onClick: () => onCellEdited?.(item, withTypedSeven(cell)),
              },
              "type 7",
            ),
          );
        }),
      ),
    );
  });

  return { ...actual, default: StubDataEditor };
});

afterEach(cleanup);

const DIRTY_TINT = "hsla(215, 100%, 96%, 1)";
const ERROR_TINT = "hsla(11, 100%, 96%, 1)";

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
    // No stock row in warehouse w1: the cell shows Saleor's empty value.
    stocks: [],
  },
];

interface HarnessProps {
  contextRef: { current: UseDatagridChangeState | undefined };
  onChange: OnDatagridChange;
}

const Harness = ({ contextRef, onChange }: HarnessProps) => {
  const datagrid = useDatagridChangeState();
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  contextRef.current = datagrid;

  // The page's state update after a grid edit, which re-renders the grid (as ProductUpdatePage's
  // changeVariants does).
  const handleChange = useCallback<OnDatagridChange>(
    (opts, setDirty) => {
      onChange(opts, setDirty);
      rerender();
    },
    [onChange],
  );

  return (
    <DatagridChangeStateContext.Provider value={datagrid}>
      <ProductVariants
        variants={variants}
        warehouses={[{ id: "w1", name: "Main warehouse" }]}
        errors={[]}
        onAddVariant={vi.fn()}
        onRowClick={vi.fn()}
        onChange={handleChange}
      />
    </DatagridChangeStateContext.Provider>
  );
};

const renderGrid = () => {
  const changes: { current: UseDatagridChangeState | undefined } = { current: undefined };
  const onChange = vi.fn();

  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter>
          <Harness contextRef={changes} onChange={onChange} />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );

  const cell = (id: string) => document.querySelector<HTMLElement>(`[data-test-id="cell-${id}"]`);
  const value = (id: string) =>
    document.querySelector<HTMLElement>(`[data-test-id="value-${id}"]`)?.textContent;
  const commit = (id: string) =>
    fireEvent.click(document.querySelector(`[data-test-id="commit-${id}"]`) as HTMLElement);
  const currentChanges = (): DatagridChange[] => changes.current?.changes.current ?? [];

  return { cell, value, commit, currentChanges, onChange };
};

describe("editing a stock cell in the Variants grid", () => {
  it("records a stock edit on a variant without a stock row, and shows it", () => {
    const { cell, value, commit, currentChanges } = renderGrid();

    expect(value("warehouse:w1-1")).toBe("-");
    expect(cell("warehouse:w1-1")?.dataset.bg).toBe("");

    commit("warehouse:w1-1");

    expect(currentChanges()).toEqual([
      { row: 1, column: "warehouse:w1", data: { kind: "number-cell", value: 7 } },
    ]);
    expect(value("warehouse:w1-1")).toBe("7");
    // Tinted as unsaved, not red: it is a valid edit.
    expect(cell("warehouse:w1-1")?.dataset.bg).toBe(DIRTY_TINT);
    expect(cell("warehouse:w1-1")?.dataset.bg).not.toBe(ERROR_TINT);
    expect(getVariantGridUpdates(variants, currentChanges())).toEqual([
      {
        id: "v2",
        input: {},
        stocks: [{ warehouse: "w1", quantity: 7 }],
      },
    ]);
  });

  it("records a stock edit on a variant that already has a stock row", () => {
    const { cell, value, commit, currentChanges } = renderGrid();

    expect(value("warehouse:w1-0")).toBe("5");

    commit("warehouse:w1-0");

    expect(value("warehouse:w1-0")).toBe("7");
    expect(cell("warehouse:w1-0")?.dataset.bg).toBe(DIRTY_TINT);
    expect(getVariantGridUpdates(variants, currentChanges())).toEqual([
      {
        id: "v1",
        input: {},
        stocks: [{ warehouse: "w1", quantity: 7 }],
      },
    ]);
  });

  it("does not tint the untouched stock cells", () => {
    const { cell, value } = renderGrid();

    expect(value("warehouse:w1-0")).toBe("5");
    expect(value("warehouse:w1-1")).toBe("-");
    expect(cell("warehouse:w1-0")?.dataset.bg).toBe("");
    expect(cell("warehouse:w1-1")?.dataset.bg).toBe("");
  });
});
