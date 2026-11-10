// Adapted from saleor-dashboard: src/components/ConditionalFilter/FiltersArea.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../Locale/Locale";
import { ConditionalProductFilterProvider } from "./context/provider";
import { FiltersArea } from "./FiltersArea";

const renderArea = () =>
  render(
    <MemoryRouter initialEntries={["/products/?sort=name&asc=true"]}>
      <LocaleProvider>
        <ConditionalProductFilterProvider locationSearch="sort=name&asc=true">
          <FiltersArea onConfirm={vi.fn()} />
        </ConditionalProductFilterProvider>
      </LocaleProvider>
    </MemoryRouter>,
  );

const byTestId = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-test-id="${id}"]`);

afterEach(cleanup);

describe("FiltersArea (real provider)", () => {
  it("adds an empty row from the add-condition button", () => {
    renderArea();

    expect(byTestId("left-0")).toBeNull();

    fireEvent.click(byTestId("add-filter-button") as HTMLElement);

    expect(byTestId("left-0")).toBeTruthy();
  });
});
