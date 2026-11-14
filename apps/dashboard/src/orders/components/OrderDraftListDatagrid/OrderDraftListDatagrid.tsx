// Adapted from saleor-dashboard: src/orders/components/OrderDraftListDatagrid/OrderDraftListDatagrid.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The drafts grid: Saleor's static columns with sort arrows, column picker, resizing and
// reordering, row link to the draft, loading and empty states and the pagination footer. Saleor's
// row selection (bulk delete) is left out: we have no draftOrderBulkDelete (PLAN M13).
import type { Item } from "@glideapps/glide-data-grid";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { ColumnPicker } from "../../../components/Datagrid/ColumnPicker/ColumnPicker";
import { useColumns } from "../../../components/Datagrid/ColumnPicker/useColumns";
import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import {
  type ListSettings,
  type ListSettingsUpdate,
  ORDER_DRAFT_LIST_DEFAULT_COLUMNS,
} from "../../../hooks/useListSettings";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import { type OrderDraftListUrlSortField, orderDraftUrl } from "../../urls";
import {
  canBeSorted,
  createGetCellContent,
  type OrderDraftListRow,
  orderDraftListStaticColumnsAdapter,
} from "./datagrid";
import { messages } from "./messages";

interface OrderDraftListDatagridProps {
  orders: OrderDraftListRow[];
  disabled: boolean;
  sort?: Sort<OrderDraftListUrlSortField>;
  onSort?: (field: OrderDraftListUrlSortField) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
}

export const OrderDraftListDatagrid = ({
  orders,
  disabled,
  sort,
  onSort,
  settings,
  onUpdateListSettings,
  hasNextPage,
  hasPreviousPage,
  nextHref,
  prevHref,
}: OrderDraftListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const memoizedStaticColumns = useMemo(
    () => orderDraftListStaticColumnsAdapter(intl, sort),
    [intl, sort],
  );

  const handleColumnChange = useCallback(
    (picked: string[]) => {
      onUpdateListSettings?.("columns", picked);
    },
    [onUpdateListSettings],
  );

  const { handlers, visibleColumns, staticColumns, selectedColumns, recentlyAddedColumn } =
    useColumns({
      gridName: "order_draft_list",
      staticColumns: memoizedStaticColumns,
      selectedColumns: settings?.columns ?? ORDER_DRAFT_LIST_DEFAULT_COLUMNS,
      onSave: handleColumnChange,
    });

  const getCellContent = useMemo(
    () => createGetCellContent(orders, visibleColumns),
    [orders, visibleColumns],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const order = orders[row];

      return order ? orderDraftUrl(order.id) : "";
    },
    [orders],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const order = orders[row];

      if (order) {
        navigate(orderDraftUrl(order.id));
      }
    },
    [orders, navigate],
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
        rows={orders.length}
        getCellContent={getCellContent}
        emptyText={intl.formatMessage(messages.emptyText)}
        onHeaderClicked={handleHeaderClick}
        renderColumnPicker={() => (
          <ColumnPicker
            staticColumns={staticColumns}
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
