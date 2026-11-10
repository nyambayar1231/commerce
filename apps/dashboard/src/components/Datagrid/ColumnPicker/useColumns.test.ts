// @vitest-environment jsdom
// Adapted from saleor-dashboard: src/components/Datagrid/ColumnPicker/useColumns.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The static-column cases. Saleor's dynamic-column cases (attributes, categories, add/remove of
// `attribute:<id>` columns) have no counterpart here.
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AvailableColumn } from "../types";
import { columnPersistanceStorageKey } from "./persistance";
import { useColumns } from "./useColumns";

const mockedColumns: AvailableColumn[] = [
  {
    id: "name",
    title: "Name",
    width: 200,
    icon: "arrowUp",
  },
  {
    id: "description",
    title: "Description",
    width: 100,
    icon: "arrowUp",
  },
];

afterEach(() => localStorage.clear());

describe("useColumns", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name", "description"],
        onSave: vi.fn(),
      }),
    );

    expect(result.current.visibleColumns).toEqual(mockedColumns);
    expect(result.current.staticColumns).toEqual(mockedColumns);
    expect(result.current.selectedColumns).toEqual(["name", "description"]);
  });

  it("should update visible column info when resized", () => {
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name", "description"],
        onSave: vi.fn(),
      }),
    );

    act(() => result.current.handlers.onResize({ id: "name", title: "Name" }, 150));

    expect(result.current.visibleColumns[0]?.width).toEqual(150);
  });

  it("should rearrange columns when moved", () => {
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name", "description"],
        onSave: vi.fn(),
      }),
    );

    act(() => result.current.handlers.onMove(1, 0));

    expect(result.current.visibleColumns).toEqual([
      {
        id: "description",
        title: "Description",
        width: 100,
        icon: "arrowUp",
      },
      {
        id: "name",
        title: "Name",
        width: 200,
        icon: "arrowUp",
      },
    ]);
  });

  it("should apply mapColumnsOnSave before calling onSave", () => {
    const onSave = vi.fn();
    const mapColumnsOnSave = (columns: string[]) => [...columns].reverse();
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name"],
        onSave,
        mapColumnsOnSave,
      }),
    );

    act(() => result.current.handlers.onToggle("description"));

    expect(onSave).toHaveBeenCalledWith(["name", "description"]);
  });

  it("should apply mapColumnsOnSave to selected columns", () => {
    const mapColumnsOnSave = (columns: string[]) => [...columns].reverse();
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name", "description"],
        onSave: vi.fn(),
        mapColumnsOnSave,
      }),
    );

    expect(result.current.selectedColumns).toEqual(["description", "name"]);
  });

  it("should call onSave when column is toggled", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name", "description"],
        onSave,
      }),
    );

    act(() => result.current.handlers.onToggle("name"));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("should add a new column at the start and set recentlyAddedColumn", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name"],
        onSave,
      }),
    );

    act(() => result.current.handlers.onToggle("description"));

    expect(onSave).toHaveBeenCalledWith(["description", "name"]);
    expect(result.current.recentlyAddedColumn).toEqual("description");
  });

  it("should persist widths and order per grid", () => {
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name", "description"],
        onSave: vi.fn(),
      }),
    );

    act(() => result.current.handlers.onResize({ id: "name", title: "Name" }, 150));
    act(() => result.current.handlers.onMove(1, 0));

    expect(JSON.parse(localStorage.getItem(columnPersistanceStorageKey) ?? "{}")).toEqual({
      test: [
        { id: "description", w: 100 },
        { id: "name", w: 150 },
      ],
    });
  });

  it("should ignore persisted columns that no longer exist", () => {
    localStorage.setItem(
      columnPersistanceStorageKey,
      JSON.stringify({ test: [{ id: "removed", w: 120 }] }),
    );
    const { result } = renderHook(() =>
      useColumns({
        gridName: "test",
        staticColumns: mockedColumns,
        selectedColumns: ["name", "description"],
        onSave: vi.fn(),
      }),
    );

    expect(result.current.selectedColumns).toEqual(["name", "description"]);
    expect(result.current.visibleColumns).toEqual(mockedColumns);
  });
});
