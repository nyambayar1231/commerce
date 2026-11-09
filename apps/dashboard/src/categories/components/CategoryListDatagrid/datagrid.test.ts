import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { CategoryFragment } from "../../../graphql/types.generated";
import { categoryListStaticColumnsAdapter, createGetCellContent } from "./datagrid";

const intl = createIntl({ locale: "en" });

const category = (name: string, children: number): CategoryFragment => ({
  __typename: "Category",
  id: name,
  name,
  children: { __typename: "CategoryCountableConnection", totalCount: children },
});

describe("category list datagrid", () => {
  it("has Saleor's columns, with the sort arrow on the sorted one", () => {
    const columns = categoryListStaticColumnsAdapter(intl, { sort: "subcategories", asc: false });
    expect(columns.map((c) => [c.id, c.title, c.icon])).toEqual([
      ["name", "Category name", undefined],
      ["subcategories", "Subcategories", "arrowDown"],
    ]);
    expect(categoryListStaticColumnsAdapter(intl, { sort: "name", asc: true })[0]?.icon).toBe(
      "arrowUp",
    );
  });

  it("renders read-only text cells for the name and subcategory count", () => {
    const columns = categoryListStaticColumnsAdapter(intl);
    const getCell = createGetCellContent([category("Shoes", 3)], columns);

    expect(getCell([0, 0])).toMatchObject({
      kind: GridCellKind.Text,
      data: "Shoes",
      readonly: true,
      cursor: "pointer",
    });
    expect(getCell([1, 0])).toMatchObject({ data: "3" });
    expect(getCell([0, 5])).toMatchObject({ data: "" });
  });
});
