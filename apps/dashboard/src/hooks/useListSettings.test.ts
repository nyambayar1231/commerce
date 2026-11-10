// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import useListSettings, {
  listSettingsStorageKey,
  PAGINATE_BY,
  PRODUCT_LIST_DEFAULT_COLUMNS,
} from "./useListSettings";

afterEach(() => localStorage.clear());

describe("useListSettings", () => {
  it("defaults to Saleor's 20 rows per page", () => {
    const { result } = renderHook(() => useListSettings("CATEGORY_LIST"));
    expect(result.current.settings.rowNumber).toBe(PAGINATE_BY);
  });

  it("defaults the product list to 20 rows and its six columns in Saleor's order", () => {
    const { result } = renderHook(() => useListSettings("PRODUCT_LIST"));

    expect(result.current.settings.rowNumber).toBe(PAGINATE_BY);
    expect(result.current.settings.columns).toEqual([
      "name",
      "availability",
      "price",
      "productCategory",
      "date",
      "created",
    ]);
  });

  it("stores the row number per list under Saleor's key", () => {
    const { result } = renderHook(() => useListSettings("CATEGORY_LIST"));
    act(() => result.current.updateListSettings("rowNumber", 50));

    expect(result.current.settings.rowNumber).toBe(50);
    expect(JSON.parse(localStorage.getItem(listSettingsStorageKey) ?? "{}")).toEqual({
      CATEGORY_LIST: { rowNumber: 50 },
      COLLECTION_PRODUCTS_LIST: { rowNumber: PAGINATE_BY },
      PRODUCT_LIST: { columns: PRODUCT_LIST_DEFAULT_COLUMNS, rowNumber: PAGINATE_BY },
    });
  });

  it("stores the product list's columns", () => {
    const { result } = renderHook(() => useListSettings("PRODUCT_LIST"));
    act(() => result.current.updateListSettings("columns", ["name", "price", "created"]));

    expect(result.current.settings.columns).toEqual(["name", "price", "created"]);
    const stored = JSON.parse(localStorage.getItem(listSettingsStorageKey) ?? "{}") as {
      PRODUCT_LIST?: { columns?: string[] };
    };

    expect(stored.PRODUCT_LIST?.columns).toEqual(["name", "price", "created"]);
  });

  it("keeps a stored column order and drops ids this list does not know", () => {
    localStorage.setItem(
      listSettingsStorageKey,
      JSON.stringify({
        PRODUCT_LIST: {
          rowNumber: PAGINATE_BY,
          columns: ["price", "removed-column", "name", "name", "availability"],
        },
      }),
    );
    const { result } = renderHook(() => useListSettings("PRODUCT_LIST"));

    expect(result.current.settings.columns).toEqual(["price", "name", "availability"]);
  });

  it("falls back to the default columns when none of the stored ids are known", () => {
    localStorage.setItem(
      listSettingsStorageKey,
      JSON.stringify({ PRODUCT_LIST: { columns: ["gone", "also-gone"] } }),
    );
    const { result } = renderHook(() => useListSettings("PRODUCT_LIST"));

    expect(result.current.settings.columns).toEqual(PRODUCT_LIST_DEFAULT_COLUMNS);
  });

  it("ignores a stored value that isn't a valid row number or column list", () => {
    localStorage.setItem(
      listSettingsStorageKey,
      JSON.stringify({ CATEGORY_LIST: { rowNumber: 5000 }, PRODUCT_LIST: { columns: "name" } }),
    );
    const category = renderHook(() => useListSettings("CATEGORY_LIST"));
    const product = renderHook(() => useListSettings("PRODUCT_LIST"));

    expect(category.result.current.settings.rowNumber).toBe(PAGINATE_BY);
    expect(product.result.current.settings.columns).toEqual(PRODUCT_LIST_DEFAULT_COLUMNS);
  });
});
