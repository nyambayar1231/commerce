import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { CategoryFragment } from "../../../graphql/types.generated";
import type { CategoryListRow } from "../../views/CategoryList/types";
import {
  categoryListExpandColumn,
  categoryListSidebarColumnsAdapter,
  categoryListStaticColumnsAdapter,
  createGetCellContent,
} from "./datagrid";

const intl = createIntl({ locale: "en" });

const category = (name: string, children: number, products = 0): CategoryFragment => ({
  __typename: "Category",
  id: name,
  name,
  children: { __typename: "CategoryCountableConnection", totalCount: children },
  products: { __typename: "ProductCountableConnection", totalCount: products },
});

const row = (name: string, children: number, products = 0, depth = 0): CategoryListRow => ({
  type: "category",
  category: category(name, children, products),
  depth,
  parentId: null,
});

describe("category list datagrid", () => {
  it("has Saleor's columns in the briefed order, with the sort arrow on the sorted one", () => {
    const columns = categoryListStaticColumnsAdapter(intl, { sort: "subcategories", asc: false });
    expect(columns.map((c) => [c.id, c.title, c.icon])).toEqual([
      ["name", "Category name", undefined],
      ["products", "Number of products", undefined],
      ["subcategories", "Subcategories", "arrowDown"],
    ]);
    expect(categoryListStaticColumnsAdapter(intl, { sort: "products", asc: true })[1]?.icon).toBe(
      "arrowUp",
    );
    expect(categoryListStaticColumnsAdapter(intl, { sort: "name", asc: true })[0]?.icon).toBe(
      "arrowUp",
    );
  });

  it("has the sidebar card's Name / Subs / Prods columns", () => {
    const columns = categoryListSidebarColumnsAdapter(intl, {
      name: 176,
      subcategories: 72,
      products: 72,
    });

    expect(columns.map((c) => [c.id, c.title, c.width])).toEqual([
      ["name", "Name", 176],
      ["subcategories", "Subs", 72],
      ["products", "Prods", 72],
    ]);
  });

  it("renders read-only text cells for the name and both counts", () => {
    const columns = categoryListStaticColumnsAdapter(intl);
    const getCell = createGetCellContent([row("Shoes", 3, 7)], columns);

    expect(getCell([0, 0])).toMatchObject({
      kind: GridCellKind.Text,
      data: "Shoes",
      readonly: true,
      cursor: "pointer",
    });
    expect(getCell([1, 0])).toMatchObject({ data: "7" });
    expect(getCell([2, 0])).toMatchObject({ data: "3" });
    expect(getCell([0, 5])).toMatchObject({ data: "" });
  });

  it("shows a chevron (or a spinner while loading) only for categories with children", () => {
    const columns = [categoryListExpandColumn, ...categoryListStaticColumnsAdapter(intl)];
    const rows = [row("Shoes", 3), row("Hats", 0), row("Bags", 2)];
    const getCell = createGetCellContent(rows, columns, {
      isCategoryExpanded: (id) => id === "Shoes",
      isCategoryChildrenLoading: (id) => id === "Bags",
    });

    expect(getCell([0, 0])).toMatchObject({ data: { kind: "chevron-cell", direction: "down" } });
    expect(getCell([0, 1])).toMatchObject({ kind: GridCellKind.Text, data: "" });
    expect(getCell([0, 2])).toMatchObject({ data: { kind: "throbber-cell" } });
  });

  it("indents children and labels load-more rows with what is left (at most a page)", () => {
    const columns = [categoryListExpandColumn, ...categoryListStaticColumnsAdapter(intl)];
    const rows: CategoryListRow[] = [
      row("Boots", 0, 0, 1),
      { type: "load-more", parentId: "Shoes", depth: 1, remainingCount: 70 },
    ];
    const getCell = createGetCellContent(rows, columns, {
      formatLoadMoreLabel: (count) => `Load ${count} more`,
    });

    expect(getCell([1, 0])).toMatchObject({ data: "\u00A0\u00A0\u00A0\u00A0Boots" });
    expect(getCell([1, 1])).toMatchObject({ data: "\u00A0\u00A0\u00A0\u00A0Load 50 more" });
  });
});
