// Adapted from saleor-dashboard: src/components/AppLayout/ListFilters/components/ExpressionFilters.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useConditionalFilterContext } from "../../../ConditionalFilter/context/consumer";
import { LocaleProvider } from "../../../Locale/Locale";
import { ExpressionFilterPanel, ExpressionFilters } from "./ExpressionFilters";

vi.mock("../../../ConditionalFilter/context/consumer", () => ({
  useConditionalFilterContext: vi.fn(),
}));
vi.mock("../../../ConditionalFilter/ConditionalFilters", () => ({
  ConditionalFilters: ({ layout }: { layout: string }): JSX.Element => (
    <div data-test-id="conditional-filters">{layout}</div>
  ),
}));

const mockUseConditionalFilterContext = vi.mocked(useConditionalFilterContext);

const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);

  if (!element) throw new Error(`no element with data-test-id="${id}"`);

  return element;
};

const setContext = ({ isOpen = false, count = 0 }: { isOpen?: boolean; count?: number } = {}) => {
  const setOpen = vi.fn();
  const resetToProvider = vi.fn();

  mockUseConditionalFilterContext.mockReturnValue({
    valueProvider: { value: [], count, loading: false, persist: vi.fn(), clear: vi.fn() },
    containerState: { resetToProvider } as never,
    filterWindow: { isOpen, setOpen },
    leftOperandsProvider: { operands: [] },
  });

  return { setOpen, resetToProvider };
};

const renderFilters = () =>
  render(
    <LocaleProvider>
      <ExpressionFilters />
    </LocaleProvider>,
  );

afterEach(cleanup);

describe("ExpressionFilters", () => {
  it("opens the panel and seeds an empty row when nothing is applied", () => {
    const { setOpen, resetToProvider } = setContext({ isOpen: false });

    renderFilters();
    fireEvent.click(byTestId("filters-button"));

    expect(resetToProvider).toHaveBeenCalledWith({ seedEmpty: true });
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it("renders the panel with the panel layout when open", () => {
    setContext({ isOpen: true, count: 1 });

    render(
      <LocaleProvider>
        <ExpressionFilterPanel />
      </LocaleProvider>,
    );

    expect(byTestId("filters-panel")).toBeTruthy();
    expect(byTestId("conditional-filters").textContent).toBe("panel");
  });

  it("does not render the panel when folded", () => {
    setContext({ isOpen: false });

    render(
      <LocaleProvider>
        <ExpressionFilterPanel />
      </LocaleProvider>,
    );

    expect(document.querySelector('[data-test-id="filters-panel"]')).toBeNull();
  });

  it("shows the applied filter count in a pill", () => {
    setContext({ count: 3 });

    renderFilters();

    expect(byTestId("filters-button").textContent).toContain("Filters");
    expect(byTestId("filters-button").textContent).toContain("3");
  });

  it("hides the pill when no filters are applied", () => {
    setContext({ count: 0 });

    renderFilters();

    expect(byTestId("filters-button").textContent).not.toContain("0");
  });

  it("folds the panel and discards drafts without clearing applied filters", () => {
    const { setOpen, resetToProvider } = setContext({ isOpen: true });

    renderFilters();
    fireEvent.click(byTestId("filters-button"));

    expect(resetToProvider).toHaveBeenCalledWith();
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
