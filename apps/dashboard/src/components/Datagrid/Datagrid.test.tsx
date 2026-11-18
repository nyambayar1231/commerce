// @vitest-environment jsdom
// A cell's error background against Glide's painting order: our Datagrid hands Glide a cell with
// `themeOverride.bgCell` for a rejected cell, but Glide 5.3's drawCells (dist/js/index.js) fills the
// cell with `theme.bgCell` and then blends `theme.accentLight` over it for the selected cell. Our
// accentLight is an opaque colour, so a cell whose only override is bgCell turns selection grey
// while it is the grid's current cell — which is exactly the rejected cell right after Save. Glide
// needs a canvas, so its DataEditor is replaced by a stub that paints a cell the way drawCells
// does: the background colour, then the selection accent over it.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../theme/provider";
import { LocaleProvider } from "../Locale/Locale";
import { textCell } from "./customCells/cells";
import { Datagrid } from "./Datagrid";

vi.mock("@glideapps/glide-data-grid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@glideapps/glide-data-grid")>();
  const React = await import("react");

  interface StubCell {
    data?: unknown;
    themeOverride?: { bgCell?: string; accentLight?: string };
  }

  interface StubSelection {
    current?: { cell: [number, number] };
  }

  interface StubProps {
    columns: { id: string; title: string }[];
    rows: number;
    theme: { bgCell: string; accentLight: string };
    gridSelection?: StubSelection;
    getCellContent: (item: [number, number]) => StubCell;
    onGridSelectionChange?: (selection: unknown) => void;
  }

  // drawCells: `theme = { ...colTheme, ...rowTheme, ...cell.themeOverride }`, the cell is filled
  // with `theme.bgCell`, and for the selected cell `accentLight` is blended over it. Every colour
  // our themes use is opaque, so the accent pass replaces the background.
  const paintedBackground = (cell: StubCell, theme: StubProps["theme"], isSelected: boolean) =>
    isSelected
      ? (cell.themeOverride?.accentLight ?? theme.accentLight)
      : (cell.themeOverride?.bgCell ?? theme.bgCell);

  const StubDataEditor = React.forwardRef(function StubDataEditor(
    { columns, rows, theme, gridSelection, getCellContent, onGridSelectionChange }: StubProps,
    _ref: unknown,
  ) {
    return React.createElement(
      "div",
      { "data-test-id": "stub-grid" },
      Array.from({ length: rows }, (_, row) =>
        Array.from({ length: columns.length }, (_, column) => {
          const item: [number, number] = [column, row];
          const id = `${columns[column]?.id ?? ""}-${row}`;
          const current = gridSelection?.current?.cell;
          const isSelected = current?.[0] === column && current?.[1] === row;

          return React.createElement(
            "div",
            {
              key: id,
              "data-test-id": `cell-${id}`,
              "data-bg": paintedBackground(getCellContent(item), theme, isSelected),
            },
            React.createElement(
              "button",
              {
                key: "select",
                type: "button",
                "data-test-id": `select-${id}`,
                onClick: () =>
                  onGridSelectionChange?.({
                    columns: actual.CompactSelection.empty(),
                    rows: actual.CompactSelection.empty(),
                    current: {
                      cell: item,
                      range: { x: column, y: row, width: 1, height: 1 },
                      rangeStack: [],
                    },
                  }),
              },
              "select",
            ),
          );
        }),
      ),
    );
  });

  return { ...actual, default: StubDataEditor };
});

afterEach(cleanup);

const columns = [
  { id: "name", title: "Name", width: 200 },
  { id: "sku", title: "SKU", width: 200 },
];

const renderGrid = () => {
  // Only the SKU column's cell is rejected (the duplicate SKU).
  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter>
          <Datagrid
            availableColumns={columns}
            emptyText="No variants"
            rows={1}
            rowMarkers="none"
            freezeColumns={0}
            getCellContent={([column, row]) => textCell(`${columns[column]?.id}-${row}`)}
            getCellError={([column]) => columns[column]?.id === "sku"}
          />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );

  const cell = (id: string) => document.querySelector<HTMLElement>(`[data-test-id="cell-${id}"]`);

  return {
    background: (id: string) => cell(id)?.dataset.bg,
    select: (id: string) =>
      fireEvent.click(document.querySelector(`[data-test-id="select-${id}"]`) as HTMLElement),
  };
};

// Macaw's defaultLight theme (the ThemeProvider's default): the error cell and the selection fill.
const ERROR_BACKGROUND = "hsla(11, 100%, 96%, 1)";
const SELECTION_BACKGROUND = "hsla(120, 11%, 98%, 1)";

describe("a cell's error background in the grid", () => {
  it("is the critical background, selected or not", () => {
    const grid = renderGrid();

    expect(grid.background("sku-0")).toBe(ERROR_BACKGROUND);

    // The rejected cell is still the grid's current cell after Save.
    grid.select("sku-0");

    expect(grid.background("sku-0")).toBe(ERROR_BACKGROUND);
  });

  it("does not colour a healthy cell", () => {
    const grid = renderGrid();

    expect(grid.background("name-0")).not.toBe(ERROR_BACKGROUND);

    grid.select("name-0");

    // A selected cell without an error keeps the selection colour.
    expect(grid.background("name-0")).toBe(SELECTION_BACKGROUND);
  });
});
