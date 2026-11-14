// Adapted from saleor-dashboard: src/orders/components/OrderDraftListDatagrid/datagrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The drafts list's columns in Saleor's order and widths: number, date, customer and total. The
// channel column is left out (single channel). Saleor prints the date as text; we use the order
// list's date cell, so both lists format dates alike. Customer is the order list's rule.
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import {
  dateCell,
  moneyCell,
  readonlyTextCell,
} from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { OrderDraftListQuery } from "../../../graphql/types.generated";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import {
  type OrderDraftListUrlSortField,
  OrderDraftListUrlSortField as SortField,
} from "../../urls";
import { getCustomerCellText } from "../OrderListDatagrid/datagrid";
import { columnsMessages } from "./messages";

export type OrderDraftListRow = NonNullable<
  OrderDraftListQuery["draftOrders"]
>["edges"][number]["node"];

export const orderDraftListStaticColumnsAdapter = (
  intl: IntlShape,
  sort?: Sort<OrderDraftListUrlSortField>,
): AvailableColumn[] =>
  [
    { id: "number", title: intl.formatMessage(columnsMessages.number), width: 100 },
    { id: "date", title: intl.formatMessage(columnsMessages.date), width: 200 },
    { id: "customer", title: intl.formatMessage(columnsMessages.customer), width: 200 },
    { id: "total", title: intl.formatMessage(columnsMessages.total), width: 200 },
  ].map((column) => ({
    ...column,
    icon: sort
      ? getColumnSortDirectionIcon(sort, column.id as OrderDraftListUrlSortField)
      : undefined,
  }));

/** The columns whose header click sorts the list (Saleor's draft sort fields). */
export const canBeSorted = (columnId: string | undefined): columnId is OrderDraftListUrlSortField =>
  columnId === SortField.number || columnId === SortField.date || columnId === SortField.customer;

const COMMON_CELL_PROPS: Partial<GridCell> = { cursor: "pointer" };

export const createGetCellContent =
  (orders: OrderDraftListRow[], columns: AvailableColumn[]) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const order = orders[row];

    if (!columnId || !order) {
      return readonlyTextCell("");
    }

    switch (columnId) {
      case "number":
        return readonlyTextCell(`#${order.number}`);
      case "date":
        return dateCell(typeof order.created === "string" ? order.created : "", COMMON_CELL_PROPS);
      case "customer":
        return readonlyTextCell(getCustomerCellText(order));
      case "total":
        return moneyCell(order.total.gross.amount, order.total.gross.currency, COMMON_CELL_PROPS);
      default:
        return readonlyTextCell("");
    }
  };
