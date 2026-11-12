// Adapted from saleor-dashboard: src/customers/components/CustomerListDatagrid/datagrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's columns and widths: name, email and, for staff who may read orders, the order count.
// The company name and external reference columns are left out (no address book or external
// references: PLAN M7 decision 4).
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import { readonlyTextCell } from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { ListCustomersQuery } from "../../../graphql/types.generated";
import { getUserName } from "../../../misc";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import { canBeSorted } from "../../sort";
import type { CustomerListUrlSortField } from "../../urls";
import { columnsMessages } from "./messages";

export type CustomerListRow = NonNullable<ListCustomersQuery["customers"]>["edges"][number]["node"];

export const customerListStaticColumnsAdapter = (
  intl: IntlShape,
  sort: Sort<CustomerListUrlSortField> | undefined,
  includeOrders: boolean,
): AvailableColumn[] =>
  [
    { id: "name", title: intl.formatMessage(columnsMessages.name), width: 450 },
    { id: "email", title: intl.formatMessage(columnsMessages.email), width: 450 },
    ...(includeOrders
      ? [{ id: "orders", title: intl.formatMessage(columnsMessages.orders), width: 200 }]
      : []),
  ].map((column) => ({
    ...column,
    icon: sort && canBeSorted(column.id) ? getColumnSortDirectionIcon(sort, column.id) : undefined,
  }));

const cellValueByColumnId: Record<string, (customer: CustomerListRow) => string | undefined> = {
  name: (customer) => getUserName(customer),
  email: (customer) => customer.email,
  orders: (customer) => customer.orders?.totalCount?.toString(),
};

export const createGetCellContent =
  (customers: CustomerListRow[], columns: AvailableColumn[]) =>
  ([column, row]: Item): GridCell => {
    const customer = customers[row];
    const columnId = columns[column]?.id;

    if (!columnId || !customer) {
      return readonlyTextCell("");
    }

    return readonlyTextCell(cellValueByColumnId[columnId]?.(customer) ?? "");
  };
