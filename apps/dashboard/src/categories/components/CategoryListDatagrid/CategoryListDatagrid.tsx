// Adapted from saleor-dashboard: src/categories/components/CategoryListDatagrid/CategoryListDatagrid.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list grid: Saleor's columns with sort arrows (header click sorts), row link to the
// category, checkbox row markers, and the pagination footer. Not yet: tree rows and selection
// handling (M2.1.8b/c), the sidebar variant (M2.1.8c), the column picker.
import type { Item } from "@glideapps/glide-data-grid";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import type { CategoryFragment } from "../../../graphql/types.generated";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import {
  type CategoryListUrlSortField,
  categoryUrl,
  CategoryListUrlSortField as SortField,
} from "../../urls";
import { categoryListStaticColumnsAdapter, createGetCellContent } from "./datagrid";
import { messages } from "./messages";

interface CategoryListDatagridProps {
  rows: CategoryFragment[];
  disabled: boolean;
  sort: Sort<CategoryListUrlSortField>;
  onSort: (field: CategoryListUrlSortField) => void;
  settings: ListSettings;
  onUpdateListSettings: ListSettingsUpdate;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextHref?: string;
  prevHref?: string;
}

export const CategoryListDatagrid = ({
  rows,
  disabled,
  sort,
  onSort,
  settings,
  onUpdateListSettings,
  hasNextPage,
  hasPreviousPage,
  nextHref,
  prevHref,
}: CategoryListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const availableColumns = useMemo(
    () => categoryListStaticColumnsAdapter(intl, sort),
    [intl, sort],
  );
  const getCellContent = useMemo(
    () => createGetCellContent(rows, availableColumns),
    [rows, availableColumns],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const category = rows[row];

      return category ? categoryUrl(category.id) : "";
    },
    [rows],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const category = rows[row];

      if (category) {
        navigate(categoryUrl(category.id));
      }
    },
    [navigate, rows],
  );

  const handleHeaderClick = useCallback(
    (col: number) => {
      const columnId = availableColumns[col]?.id;

      switch (columnId) {
        case SortField.name:
        case SortField.subcategoryCount:
          onSort(columnId);
          break;
      }
    },
    [availableColumns, onSort],
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
        emptyText={intl.formatMessage(messages.noData)}
        onHeaderClicked={handleHeaderClick}
        rowAnchor={handleRowAnchor}
        onRowClick={handleRowClick}
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
