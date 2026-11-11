// Adapted from saleor-dashboard: src/orders/components/OrderListDatagrid/OrderListDatagrid.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order list grid: Saleor's static columns with sort arrows (header click sorts the sortable
// ones), column picker, resizing and reordering, no row markers, row link to the order, loading and
// empty states and the pagination footer. Not yet: Saleor's empty spacer column and its
// "net before total" column ordering (no net column).
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
  ORDER_LIST_DEFAULT_COLUMNS,
} from "../../../hooks/useListSettings";
import { useTheme } from "../../../theme/hook";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import { type OrderListUrlSortField, orderUrl } from "../../urls";
import {
  canBeSorted,
  createGetCellContent,
  type OrderListRow,
  orderListStaticColumnAdapter,
} from "./datagrid";
import { messages } from "./messages";

interface OrderListDatagridProps {
  orders: OrderListRow[];
  disabled: boolean;
  sort?: Sort<OrderListUrlSortField>;
  onSort?: (field: OrderListUrlSortField) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
}

export const OrderListDatagrid = ({
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
}: OrderListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const memoizedStaticColumns = useMemo(
    () => orderListStaticColumnAdapter(intl, sort),
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
      gridName: "order_list",
      staticColumns: memoizedStaticColumns,
      selectedColumns: settings?.columns ?? ORDER_LIST_DEFAULT_COLUMNS,
      onSave: handleColumnChange,
    });

  const getCellContent = useMemo(
    () => createGetCellContent(orders, visibleColumns, { intl, theme }),
    [orders, visibleColumns, intl, theme],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const order = orders[row];

      return order ? orderUrl(order.id) : "";
    },
    [orders],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const order = orders[row];

      if (order) {
        navigate(orderUrl(order.id));
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
