// Adapted from saleor-dashboard: src/products/components/ProductListViewSwitch/ProductListViewSwitch.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ProductListViewSwitch } from "./ProductListViewSwitch";

configure({ testIdAttribute: "data-test-id" });

afterEach(cleanup);

const renderSwitch = (defaultValue: "datagrid" | "tile") => {
  const setProductListViewType = vi.fn();

  render(
    <LocaleProvider>
      <ProductListViewSwitch
        defaultValue={defaultValue}
        setProductListViewType={setProductListViewType}
      />
    </LocaleProvider>,
  );

  return { setProductListViewType };
};

describe("ProductListViewSwitch", () => {
  it("sets title and aria-label on list and grid buttons", () => {
    renderSwitch("datagrid");

    const listViewButton = screen.getByTestId("datagrid-view-button");
    const gridViewButton = screen.getByTestId("tile-view-button");

    expect(listViewButton.getAttribute("title")).toBe("List view");
    expect(listViewButton.getAttribute("aria-label")).toBe("List view");
    expect(gridViewButton.getAttribute("title")).toBe("Grid view");
    expect(gridViewButton.getAttribute("aria-label")).toBe("Grid view");
  });

  it("sets the tile view when the grid button is clicked", () => {
    const { setProductListViewType } = renderSwitch("datagrid");

    fireEvent.click(screen.getByTestId("tile-view-button"));

    expect(setProductListViewType).toHaveBeenCalledWith("tile");
  });

  it("sets the datagrid view when the list button is clicked", () => {
    const { setProductListViewType } = renderSwitch("tile");

    fireEvent.click(screen.getByTestId("datagrid-view-button"));

    expect(setProductListViewType).toHaveBeenCalledWith("datagrid");
  });
});
