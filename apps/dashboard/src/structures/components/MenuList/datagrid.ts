// Adapted from saleor-dashboard: src/structures/components/MenuList/MenuList.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's two columns: the structure title and the number of items. The API's `items` returns the
// top level only, so the count adds the nested children (the fragment carries their ids).
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import { readonlyTextCell } from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { MenuFragment } from "../../../graphql/types.generated";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import { type MenuListUrlSortField, MenuListUrlSortField as SortField } from "../../urls";
import { columnsMessages } from "./messages";

export const menuListStaticColumnsAdapter = (
  intl: IntlShape,
  sort?: Sort<MenuListUrlSortField>,
): AvailableColumn[] =>
  [
    {
      id: SortField.name,
      title: intl.formatMessage(columnsMessages.name),
      width: 450,
      grow: 1,
    },
    {
      id: SortField.items,
      title: intl.formatMessage(columnsMessages.items),
      width: 200,
      grow: 0,
    },
  ].map((column) => ({
    ...column,
    icon: sort ? getColumnSortDirectionIcon(sort, column.id as MenuListUrlSortField) : undefined,
  }));

/** Every item of a menu, at any depth its fragment carries. */
export const countMenuItems = (menu: MenuFragment): number =>
  menu.items.reduce(
    (count, item) =>
      count +
      1 +
      item.children.reduce((childCount, child) => childCount + 1 + child.children.length, 0),
    0,
  );

export const createGetCellContent =
  (rows: MenuFragment[], columns: AvailableColumn[]) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const menu = rows[row];

    if (!columnId || !menu) {
      return readonlyTextCell("", false);
    }

    switch (columnId) {
      case SortField.name:
        return readonlyTextCell(menu.name);
      case SortField.items:
        return readonlyTextCell(String(countMenuItems(menu)));
      default:
        return readonlyTextCell("", false);
    }
  };
