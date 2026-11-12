// Adapted from saleor-dashboard: src/customers/components/CustomerListDatagrid/CustomerListDatagrid.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The customer list grid: Saleor's columns with sort arrows (header click sorts the sortable ones),
// column picker, resizing and reordering, a row link to the customer, the empty text (naming the
// search) and the pagination footer. The order count column is offered only to staff with
// MANAGE_ORDERS, as in Saleor. Not yet: row checkboxes for bulk delete (M7.5).
import type { Item } from "@glideapps/glide-data-grid";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { ColumnPicker } from "../../../components/Datagrid/ColumnPicker/ColumnPicker";
import { useColumns } from "../../../components/Datagrid/ColumnPicker/useColumns";
import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import {
  CUSTOMER_LIST_DEFAULT_COLUMNS,
  type ListSettings,
  type ListSettingsUpdate,
} from "../../../hooks/useListSettings";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import { canBeSorted } from "../../sort";
import { type CustomerListUrlSortField, customerUrl } from "../../urls";
import {
  type CustomerListRow,
  createGetCellContent,
  customerListStaticColumnsAdapter,
} from "./datagrid";
import { emptySearchMessage, messages } from "./messages";

interface CustomerListDatagridProps {
  customers: CustomerListRow[];
  disabled: boolean;
  includeOrders: boolean;
  searchQuery?: string;
  sort?: Sort<CustomerListUrlSortField>;
  onSort?: (field: CustomerListUrlSortField) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
}

export const CustomerListDatagrid = ({
  customers,
  disabled,
  includeOrders,
  searchQuery,
  sort,
  onSort,
  settings,
  onUpdateListSettings,
  hasNextPage,
  hasPreviousPage,
  nextHref,
  prevHref,
}: CustomerListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const staticColumns = useMemo(
    () => customerListStaticColumnsAdapter(intl, sort, includeOrders),
    [intl, sort, includeOrders],
  );

  const handleColumnChange = useCallback(
    (picked: string[]) => {
      onUpdateListSettings?.("columns", picked.filter(Boolean));
    },
    [onUpdateListSettings],
  );

  const { handlers, visibleColumns, selectedColumns, recentlyAddedColumn, ...columns } = useColumns(
    {
      gridName: "customer_list",
      staticColumns,
      selectedColumns: settings?.columns ?? CUSTOMER_LIST_DEFAULT_COLUMNS,
      onSave: handleColumnChange,
    },
  );

  const getCellContent = useMemo(
    () => createGetCellContent(customers, visibleColumns),
    [customers, visibleColumns],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const customer = customers[row];

      return customer ? customerUrl(customer.id) : "";
    },
    [customers],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const customer = customers[row];

      if (customer) {
        navigate(customerUrl(customer.id));
      }
    },
    [customers, navigate],
  );

  const handleHeaderClick = useCallback(
    (col: number) => {
      const columnId = visibleColumns[col]?.id;

      if (canBeSorted(columnId)) {
        onSort?.(columnId);
      }
    },
    [visibleColumns, onSort],
  );

  return (
    <>
      <Datagrid
        readonly
        hasRowHover
        loading={disabled}
        verticalBorder={false}
        rowMarkers="none"
        availableColumns={visibleColumns}
        rows={customers.length}
        getCellContent={getCellContent}
        emptyText={
          searchQuery
            ? intl.formatMessage(emptySearchMessage, { query: searchQuery })
            : intl.formatMessage(messages.empty)
        }
        onHeaderClicked={handleHeaderClick}
        renderColumnPicker={() => (
          <ColumnPicker
            staticColumns={columns.staticColumns}
            selectedColumns={selectedColumns}
            onToggle={handlers.onToggle}
          />
        )}
        onColumnMoved={handlers.onMove}
        onColumnResize={handlers.onResize}
        recentlyAddedColumn={recentlyAddedColumn}
        onClearRecentlyAddedColumn={handlers.onClearRecentlyAddedColumn}
        rowAnchor={handleRowAnchor}
        onRowClick={handleRowClick}
        showTopBorder
      />
      <DatagridPagination
        settings={settings}
        disabled={disabled}
        onUpdateListSettings={onUpdateListSettings}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        nextHref={nextHref}
        prevHref={prevHref}
      />
    </>
  );
};
