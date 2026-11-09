// Adapted from saleor-dashboard: src/categories/components/CategoryListDatagrid/datagrid.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Flat rows so far: the tree (expand chevron, indented names, "load more" rows) is M2.1.8b, and
// Saleor's "Number of products" column arrives with products (M2.2).
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import { readonlyTextCell } from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { CategoryFragment } from "../../../graphql/types.generated";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import type { CategoryListUrlSortField } from "../../urls";
import { columnsMessages } from "./messages";

export const categoryListStaticColumnsAdapter = (
  intl: IntlShape,
  sort?: Sort<CategoryListUrlSortField>,
): AvailableColumn[] =>
  [
    {
      id: "name",
      title: intl.formatMessage(columnsMessages.categoryName),
      width: 350,
    },
    {
      id: "subcategories",
      title: intl.formatMessage(columnsMessages.subcategories),
      width: 300,
    },
  ].map((column) => ({
    ...column,
    icon: sort
      ? getColumnSortDirectionIcon(sort, column.id as CategoryListUrlSortField)
      : undefined,
  }));

export const createGetCellContent =
  (rows: CategoryFragment[], columns: AvailableColumn[]) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const category = rows[row];

    if (!columnId || !category) {
      return readonlyTextCell("");
    }

    switch (columnId) {
      case "name":
        return readonlyTextCell(category.name);
      case "subcategories":
        return readonlyTextCell(category.children?.totalCount?.toString() ?? "");
      default:
        return readonlyTextCell("", false);
    }
  };
