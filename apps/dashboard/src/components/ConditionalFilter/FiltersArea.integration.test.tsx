// Adapted from saleor-dashboard: src/components/ConditionalFilter/FiltersArea.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../Locale/Locale";
import { ConditionalProductFilterProvider } from "./context/provider";
import { FiltersArea } from "./FiltersArea";

const renderArea = () =>
  render(
    // No category filter in the URL, so the provider's initial-state lookup runs no query.
    <MockedProvider mocks={[]}>
      <MemoryRouter initialEntries={["/products/?sort=name&asc=true"]}>
        <LocaleProvider>
          <ConditionalProductFilterProvider locationSearch="sort=name&asc=true">
            <FiltersArea onConfirm={vi.fn()} />
          </ConditionalProductFilterProvider>
        </LocaleProvider>
      </MemoryRouter>
    </MockedProvider>,
  );

const byTestId = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-test-id="${id}"]`);

afterEach(cleanup);

describe("FiltersArea (real provider)", () => {
  it("adds an empty row from the add-condition button", async () => {
    renderArea();

    // The provider starts on its skeleton until the URL's filter values are looked up.
    await waitFor(() => expect(byTestId("add-filter-button")).toBeTruthy());

    expect(byTestId("left-0")).toBeNull();

    fireEvent.click(byTestId("add-filter-button") as HTMLElement);

    expect(byTestId("left-0")).toBeTruthy();
  });
});
