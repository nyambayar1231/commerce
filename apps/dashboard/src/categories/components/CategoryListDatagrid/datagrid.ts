// Adapted from saleor-dashboard: src/categories/components/CategoryListDatagrid/datagrid.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's tree grid: an expand column (chevron, or a spinner while children load), names indented
// by depth, and "Load N more subcategories" rows. Saleor's "Number of products" column arrives with
// products (M2.2), in both the page and the sidebar variant.
import type { GridCell, Item, Theme } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import {
  chevronCell,
  loadingCell,
  loadMoreTextCell,
  readonlyTextCell,
} from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import type { CategoryListUrlSortField } from "../../urls";
import { SUBCATEGORIES_PAGE_SIZE } from "../../views/CategoryList/services/categoryChildrenQueries";
import type { CategoryListRow } from "../../views/CategoryList/types";
import { formatIndentedTreeLabel } from "../../views/CategoryList/utils/treeIndent";
import { columnsMessages } from "./messages";

interface CreateGetCellContentOptions {
  isCategoryExpanded?: (categoryId: string) => boolean;
  isCategoryChildrenLoading?: (categoryId: string) => boolean;
  isLoadingMoreSubcategories?: (parentId: string) => boolean;
  getCategoryDepth?: (categoryId: string) => number;
  formatLoadMoreLabel?: (remainingCount: number) => string;
  loadMoreCellThemeOverride?: Partial<Theme>;
}

export const categoryListExpandColumn: AvailableColumn = {
  id: "expand",
  title: "",
  width: 20,
  action: () => true,
};

export const categoryListStaticColumnsAdapter = (
  intl: IntlShape,
  sort?: Sort<CategoryListUrlSortField>,
): AvailableColumn[] =>
  [
    {
      id: "name",
      title: intl.formatMessage(columnsMessages.categoryName),
      width: 350,
    },
    {
      id: "subcategories",
      title: intl.formatMessage(columnsMessages.subcategories),
      width: 300,
    },
  ].map((column) => ({
    ...column,
    icon: sort
      ? getColumnSortDirectionIcon(sort, column.id as CategoryListUrlSortField)
      : undefined,
  }));

export interface SidebarColumnWidths {
  name: number;
  subcategories: number;
}

/** Sidebar membership list (the detail page's Subcategories card). */
export const categoryListSidebarColumnsAdapter = (
  intl: IntlShape,
  widths: SidebarColumnWidths,
): AvailableColumn[] => [
  {
    id: "name",
    title: intl.formatMessage(columnsMessages.name),
    width: widths.name,
  },
  {
    id: "subcategories",
    title: intl.formatMessage(columnsMessages.sidebarSubcategories),
    width: widths.subcategories,
  },
];

const getLoadMoreCount = (remainingCount: number): number =>
  Math.min(SUBCATEGORIES_PAGE_SIZE, remainingCount);

export const createGetCellContent =
  (
    rows: CategoryListRow[],
    columns: AvailableColumn[],
    {
      isCategoryExpanded,
      isCategoryChildrenLoading,
      isLoadingMoreSubcategories,
      getCategoryDepth,
      formatLoadMoreLabel,
      loadMoreCellThemeOverride,
    }: CreateGetCellContentOptions = {},
  ) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const rowData = rows[row];

    if (!columnId || !rowData) {
      return readonlyTextCell("");
    }

    if (rowData.type === "load-more") {
      const isLoadingMore = isLoadingMoreSubcategories?.(rowData.parentId) ?? false;

      switch (columnId) {
        case "expand":
          return isLoadingMore ? loadingCell() : readonlyTextCell("", false);
        case "name":
          return loadMoreTextCell(
            formatIndentedTreeLabel(
              formatLoadMoreLabel?.(getLoadMoreCount(rowData.remainingCount)) ?? "",
              rowData.depth,
            ),
            loadMoreCellThemeOverride,
            { loading: isLoadingMore },
          );
        default:
          return readonlyTextCell("", false);
      }
    }

    const category = rowData.category;

    switch (columnId) {
      case "expand": {
        if (!category.children?.totalCount) {
          return readonlyTextCell("", false);
        }

        if (isCategoryChildrenLoading?.(category.id)) {
          return loadingCell();
        }

        return chevronCell(isCategoryExpanded?.(category.id) ?? false);
      }
      case "name": {
        const depth = getCategoryDepth?.(category.id) ?? rowData.depth;

        return readonlyTextCell(formatIndentedTreeLabel(category.name ?? "", depth));
      }
      case "subcategories":
        return readonlyTextCell(category.children?.totalCount?.toString() ?? "");
      default:
        return readonlyTextCell("", false);
    }
  };
