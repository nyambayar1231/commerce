// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import useListSettings, { listSettingsStorageKey, PAGINATE_BY } from "./useListSettings";

afterEach(() => localStorage.clear());

describe("useListSettings", () => {
  it("defaults to Saleor's 20 rows per page", () => {
    const { result } = renderHook(() => useListSettings("CATEGORY_LIST"));
    expect(result.current.settings.rowNumber).toBe(PAGINATE_BY);
  });

  it("stores the row number per list under Saleor's key", () => {
    const { result } = renderHook(() => useListSettings("CATEGORY_LIST"));
    act(() => result.current.updateListSettings("rowNumber", 50));

    expect(result.current.settings.rowNumber).toBe(50);
    expect(JSON.parse(localStorage.getItem(listSettingsStorageKey) ?? "{}")).toEqual({
      CATEGORY_LIST: { rowNumber: 50 },
    });
  });

  it("ignores a stored value that isn't a valid row number", () => {
    localStorage.setItem(
      listSettingsStorageKey,
      JSON.stringify({ CATEGORY_LIST: { rowNumber: 5000 } }),
    );
    const { result } = renderHook(() => useListSettings("CATEGORY_LIST"));
    expect(result.current.settings.rowNumber).toBe(PAGINATE_BY);
  });
});
