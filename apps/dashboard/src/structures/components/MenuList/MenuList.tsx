// Adapted from saleor-dashboard: src/structures/components/MenuList/MenuList.tsx and
// src/modeling/components/PageListDatagrid/PageListDatagrid.tsx (BSD-3-Clause, Copyright (c)
// 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list grid in our datagrid house style: sortable headers, the row link to the menu, checkbox
// row markers, row selection and the pagination footer. Saleor's table has a per-row delete button;
// this grid deletes through the selection and the bulk dialog, as our other lists do.
import type { Item } from "@glideapps/glide-data-grid";
import { Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";
import type { RowActionItem } from "../../../components/Datagrid/components/RowActions";
import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import type { MenuFragment } from "../../../graphql/types.generated";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import { buttonMessages } from "../../../intl";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import { type MenuListUrlSortField, menuUrl, MenuListUrlSortField as SortField } from "../../urls";
import { createGetCellContent, menuListStaticColumnsAdapter } from "./datagrid";
import { messages } from "./messages";

interface MenuListProps {
  rows: MenuFragment[];
  disabled: boolean;
  sort?: Sort<MenuListUrlSortField>;
  onSort?: (field: MenuListUrlSortField) => void;
  onDelete: (id: string) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
  /** Selected menu ids, plus a callback that clears the grid's selection. */
  onSelectedMenuIdsChange?: (ids: string[], clearSelection: () => void) => void;
}

export const MenuList = ({
  rows,
  disabled,
  sort,
  onSort,
  onDelete,
  settings,
  onUpdateListSettings,
  hasNextPage,
  hasPreviousPage,
  nextHref,
  prevHref,
  onSelectedMenuIdsChange,
}: MenuListProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const availableColumns = useMemo(() => menuListStaticColumnsAdapter(intl, sort), [intl, sort]);
  const getCellContent = useMemo(
    () => createGetCellContent(rows, availableColumns),
    [rows, availableColumns],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const menu = rows[row];

      return menu ? menuUrl(menu.id) : "";
    },
    [rows],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const menu = rows[row];

      if (menu) {
        navigate(menuUrl(menu.id));
      }
    },
    [rows, navigate],
  );

  const handleRowSelectionChange = useCallback(
    (selectedRows: number[], clearSelection: () => void) => {
      const ids = selectedRows.flatMap((index) => {
        const menu = rows[index];

        return menu ? [menu.id] : [];
      });

      onSelectedMenuIdsChange?.(ids, clearSelection);
    },
    [rows, onSelectedMenuIdsChange],
  );

  const handleHeaderClick = useCallback(
    (col: number) => {
      const columnId = availableColumns[col]?.id;

      switch (columnId) {
        case SortField.name:
        case SortField.items:
          onSort?.(columnId);
          break;
      }
    },
    [availableColumns, onSort],
  );

  // Saleor's per-row delete icon: opens the single-row delete dialog (the row is in the URL's id).
  const getRowActions = useCallback(
    (index: number): RowActionItem[] => {
      const menu = rows[index];

      if (!menu) {
        return [];
      }

      return [
        {
          label: intl.formatMessage(buttonMessages.delete),
          onSelect: () => onDelete(menu.id),
          testId: "delete-menu",
          color: "critical1",
          icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
        },
      ];
    },
    [rows, onDelete, intl],
  );

  return (
    <>
      <Datagrid
        readonly
        hasRowHover
        loading={disabled}
        verticalBorder={false}
        rowMarkers="checkbox-visible"
        availableColumns={availableColumns}
        rows={rows.length}
        getCellContent={getCellContent}
        emptyText={intl.formatMessage(messages.empty)}
        onHeaderClicked={handleHeaderClick}
        rowAnchor={handleRowAnchor}
        onRowClick={handleRowClick}
        onRowSelectionChange={handleRowSelectionChange}
        menuItems={getRowActions}
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
