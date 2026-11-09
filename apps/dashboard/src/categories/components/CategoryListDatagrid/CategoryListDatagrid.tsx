// Adapted from saleor-dashboard: src/categories/components/CategoryListDatagrid/CategoryListDatagrid.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list grid: Saleor's expandable tree (chevron column, indented children, "load more" rows),
// columns with sort arrows (header click sorts), row link to the category, checkbox row markers and
// the pagination footer, and row selection (category rows only). The "sidebar" variant is the
// detail page's Subcategories list: compact rows, "Name"/"Subs" headers, no sorting and no
// footer (the card paginates). Not yet: tree rows in the sidebar, the column picker.
import type { Item, Theme } from "@glideapps/glide-data-grid";
import { useTheme } from "@saleor/macaw-ui";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import {
  type CategoryListUrlSortField,
  categoryUrl,
  CategoryListUrlSortField as SortField,
} from "../../urls";
import type { CategoryListRow } from "../../views/CategoryList/types";
import {
  categoryListExpandColumn,
  categoryListSidebarColumnsAdapter,
  categoryListStaticColumnsAdapter,
  createGetCellContent,
} from "./datagrid";

// Saleor's sidebar sizes (CategoryListDatagrid.tsx); its widths are measured from the card, ours
// are fixed to fit the right column.
const SIDEBAR_ROW_HEIGHT = 36;
const SIDEBAR_ROW_MARKER_WIDTH = 36;
const SIDEBAR_COLUMN_WIDTHS = { name: 200, subcategories: 72 };
// Glide: checkboxSize = min(18, rowHeight − 2 * cellVerticalPadding)
const sidebarRowMarkerTheme: Partial<Theme> = { cellVerticalPadding: 11, cellHorizontalPadding: 4 };

import { loadMoreSubcategoriesMessage, messages } from "./messages";

interface CategoryListDatagridProps {
  variant?: "page" | "sidebar";
  rows: CategoryListRow[];
  disabled: boolean;
  sort?: Sort<CategoryListUrlSortField>;
  onSort?: (field: CategoryListUrlSortField) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
  isCategoryExpanded?: (categoryId: string) => boolean;
  onCategoryExpandToggle?: (categoryId: string) => void;
  isCategoryChildrenLoading?: (categoryId: string) => boolean;
  isLoadingMoreSubcategories?: (parentId: string) => boolean;
  getCategoryDepth?: (categoryId: string) => number;
  onLoadMoreSubcategories?: (parentId: string) => void;
  /** Selected category ids, plus a callback that clears the grid's selection. */
  onSelectedCategoriesIdsChange?: (ids: string[], clearSelection: () => void) => void;
}

export const CategoryListDatagrid = ({
  variant = "page",
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
  isCategoryExpanded,
  onCategoryExpandToggle,
  isCategoryChildrenLoading,
  isLoadingMoreSubcategories,
  getCategoryDepth,
  onLoadMoreSubcategories,
  onSelectedCategoriesIdsChange,
}: CategoryListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { themeValues } = useTheme();
  const isSidebar = variant === "sidebar";
  const availableColumns = useMemo(
    () =>
      isSidebar
        ? categoryListSidebarColumnsAdapter(intl, SIDEBAR_COLUMN_WIDTHS)
        : [categoryListExpandColumn, ...categoryListStaticColumnsAdapter(intl, sort)],
    [intl, isSidebar, sort],
  );
  const sidebarDatagridTheme = useMemo(
    (): Partial<Theme> => ({
      bgHeader: themeValues.colors.background.default1,
      bgHeaderHasFocus: themeValues.colors.background.default1,
      bgHeaderHovered: themeValues.colors.background.default1,
      textHeader: themeValues.colors.text.default2,
      textHeaderSelected: themeValues.colors.text.default2,
      headerFontStyle: `${themeValues.fontWeight.regular} ${themeValues.fontSize[2]}`,
    }),
    [themeValues],
  );

  const formatLoadMoreLabel = useCallback(
    (remainingCount: number) =>
      intl.formatMessage(loadMoreSubcategoriesMessage, { count: remainingCount }),
    [intl],
  );
  const loadMoreCellThemeOverride = useMemo(
    () => ({
      baseFontStyle: `${themeValues.fontWeight.regular} ${themeValues.fontSize[2]}`,
      textDark: themeValues.colors.text.accent1,
    }),
    [themeValues],
  );

  // "Load more" rows have no checkbox and no hover highlight.
  const getRowThemeOverride = useCallback(
    (row: number) => {
      if (rows[row]?.type !== "load-more") {
        return undefined;
      }

      const background = themeValues.colors.background.default1;

      return {
        bgCell: background,
        accentColor: background,
        accentLight: background,
        accentFg: background,
      };
    },
    [rows, themeValues.colors.background.default1],
  );

  const getCellContent = useMemo(
    () =>
      createGetCellContent(rows, availableColumns, {
        isCategoryExpanded,
        isCategoryChildrenLoading,
        isLoadingMoreSubcategories,
        getCategoryDepth,
        formatLoadMoreLabel,
        loadMoreCellThemeOverride,
      }),
    [
      rows,
      availableColumns,
      isCategoryExpanded,
      isCategoryChildrenLoading,
      isLoadingMoreSubcategories,
      getCategoryDepth,
      formatLoadMoreLabel,
      loadMoreCellThemeOverride,
    ],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const rowData = rows[row];

      return rowData?.type === "category" ? categoryUrl(rowData.category.id) : "";
    },
    [rows],
  );

  const handleRowClick = useCallback(
    ([col, row]: Item) => {
      const rowData = rows[row];

      if (!rowData) {
        return;
      }

      if (rowData.type === "load-more") {
        if (
          availableColumns[col]?.id === "name" &&
          !isLoadingMoreSubcategories?.(rowData.parentId)
        ) {
          onLoadMoreSubcategories?.(rowData.parentId);
        }

        return;
      }

      if (availableColumns[col]?.id === "expand") {
        const hasSubcategories = (rowData.category.children?.totalCount ?? 0) > 0;

        if (hasSubcategories && !isCategoryChildrenLoading?.(rowData.category.id)) {
          onCategoryExpandToggle?.(rowData.category.id);
        }

        return;
      }

      navigate(categoryUrl(rowData.category.id));
    },
    [
      availableColumns,
      rows,
      navigate,
      onCategoryExpandToggle,
      isCategoryChildrenLoading,
      isLoadingMoreSubcategories,
      onLoadMoreSubcategories,
    ],
  );

  const handleRowSelectionChange = useCallback(
    (selectedRows: number[], clearSelection: () => void) => {
      const ids = selectedRows.flatMap((index) => {
        const rowData = rows[index];

        return rowData?.type === "category" ? [rowData.category.id] : [];
      });

      onSelectedCategoriesIdsChange?.(ids, clearSelection);
    },
    [rows, onSelectedCategoriesIdsChange],
  );

  const handleHeaderClick = useCallback(
    (col: number) => {
      const columnId = availableColumns[col]?.id;

      switch (columnId) {
        case SortField.name:
        case SortField.subcategoryCount:
          onSort?.(columnId);
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
        getRowThemeOverride={getRowThemeOverride}
        onRowSelectionChange={handleRowSelectionChange}
        rowHeight={isSidebar ? SIDEBAR_ROW_HEIGHT : undefined}
        headerHeight={isSidebar ? SIDEBAR_ROW_HEIGHT : undefined}
        rowMarkerWidth={isSidebar ? SIDEBAR_ROW_MARKER_WIDTH : undefined}
        rowMarkerTheme={isSidebar ? sidebarRowMarkerTheme : undefined}
        themeOverride={isSidebar ? sidebarDatagridTheme : undefined}
        showTopBorder={!isSidebar}
      />
      {!isSidebar && (
        <DatagridPagination
          settings={settings}
          disabled={disabled}
          onUpdateListSettings={onUpdateListSettings}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          nextHref={nextHref}
          prevHref={prevHref}
        />
      )}
    </>
  );
};
