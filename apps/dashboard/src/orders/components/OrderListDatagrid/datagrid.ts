// Adapted from saleor-dashboard: src/orders/components/OrderListDatagrid/datagrid.ts and utils.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order list's columns in Saleor's order and widths: number, date, customer, payment, status
// and total. Saleor's empty spacer column and the delivery, net and channel columns are left out
// (no delivery methods, net subtotal or channels in our list). Payment and status are Saleor's
// pills, date its date cell and total its money cell.
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { DefaultTheme } from "@saleor/macaw-ui";
import type { IntlShape } from "react-intl";

import {
  dateCell,
  moneyCell,
  pillCell,
  readonlyTextCell,
} from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { OrderListQuery } from "../../../graphql/types.generated";
import { getStatusColor, transformOrderStatus, transformPaymentStatus } from "../../../misc";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import { type OrderListUrlSortField, OrderListUrlSortField as SortField } from "../../urls";
import { columnsMessages } from "./messages";

export type OrderListRow = NonNullable<OrderListQuery["orders"]>["edges"][number]["node"];

export const orderListStaticColumnAdapter = (
  intl: IntlShape,
  sort?: Sort<OrderListUrlSortField>,
): AvailableColumn[] =>
  [
    { id: "number", title: intl.formatMessage(columnsMessages.number), width: 100 },
    { id: "date", title: intl.formatMessage(columnsMessages.date), width: 300 },
    { id: "customer", title: intl.formatMessage(columnsMessages.customer), width: 200 },
    { id: "payment", title: intl.formatMessage(columnsMessages.payment), width: 200 },
    { id: "status", title: intl.formatMessage(columnsMessages.status), width: 200 },
    {
      id: "total",
      title: intl.formatMessage(columnsMessages.total),
      width: 150,
      headerAlign: "right" as const,
    },
  ].map((column) => ({
    ...column,
    icon: sort ? getColumnSortDirectionIcon(sort, column.id as OrderListUrlSortField) : undefined,
  }));

/** Saleor's canBeSorted: the columns whose header click sorts the list. */
export const canBeSorted = (columnId: string | undefined): columnId is OrderListUrlSortField => {
  switch (columnId) {
    case SortField.number:
    case SortField.date:
    case SortField.customer:
    case SortField.payment:
    case SortField.fulfillment:
      return true;
    default:
      return false;
  }
};

const COMMON_CELL_PROPS: Partial<GridCell> = { cursor: "pointer" };

/** Saleor's getCustomerCellContent: the billing name, else the email, else "-". */
export const getCustomerCellText = (
  order: Pick<OrderListRow, "billingAddress" | "userEmail">,
): string => {
  if (order.billingAddress?.firstName && order.billingAddress?.lastName) {
    return `${order.billingAddress.firstName} ${order.billingAddress.lastName}`;
  }

  return order.userEmail || "-";
};

interface CreateGetCellContentOptions {
  intl: IntlShape;
  theme: DefaultTheme;
}

export const createGetCellContent =
  (
    orders: OrderListRow[],
    columns: AvailableColumn[],
    { intl, theme }: CreateGetCellContentOptions,
  ) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const order = orders[row];

    if (!columnId || !order) {
      return readonlyTextCell("");
    }

    switch (columnId) {
      case "number":
        return readonlyTextCell(order.number);
      case "date":
        return dateCell(typeof order.created === "string" ? order.created : "", COMMON_CELL_PROPS);
      case "customer":
        return readonlyTextCell(getCustomerCellText(order));
      case "payment": {
        const { localized, status } = transformPaymentStatus(order, intl);

        return pillCell(
          localized,
          getStatusColor({ status, currentTheme: theme }),
          COMMON_CELL_PROPS,
        );
      }
      case "status": {
        const { localized, status } = transformOrderStatus(order.status, intl);

        return pillCell(
          localized,
          getStatusColor({ status, currentTheme: theme }),
          COMMON_CELL_PROPS,
        );
      }
      case "total":
        return moneyCell(order.total.gross.amount, order.total.gross.currency, COMMON_CELL_PROPS);
      default:
        return readonlyTextCell("");
    }
  };
