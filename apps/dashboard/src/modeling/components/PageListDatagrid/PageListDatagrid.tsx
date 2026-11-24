// Adapted from saleor-dashboard: src/modeling/components/PageListDatagrid/PageListDatagrid.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list grid: columns with sort arrows (header click sorts), row link to the page, checkbox row
// markers, row selection and the pagination footer. Saleor's column picker, its page-type icon
// cell and its channel tooltip (one channel) are left out.
import type { Item } from "@glideapps/glide-data-grid";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import type { PageListRowFragment } from "../../../graphql/types.generated";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import { type PageListUrlSortField, pageUrl, PageListUrlSortField as SortField } from "../../urls";
import { createGetCellContent, pageListStaticColumnsAdapter } from "./datagrid";
import { messages } from "./messages";

interface PageListDatagridProps {
  rows: PageListRowFragment[];
  disabled: boolean;
  sort?: Sort<PageListUrlSortField>;
  onSort?: (field: PageListUrlSortField) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
  /** Selected page ids, plus a callback that clears the grid's selection. */
  onSelectedPageIdsChange?: (ids: string[], clearSelection: () => void) => void;
}

export const PageListDatagrid = ({
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
  onSelectedPageIdsChange,
}: PageListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const availableColumns = useMemo(() => pageListStaticColumnsAdapter(intl, sort), [intl, sort]);
  const getCellContent = useMemo(
    () => createGetCellContent(rows, availableColumns, { intl }),
    [rows, availableColumns, intl],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const page = rows[row];

      return page ? pageUrl(page.id) : "";
    },
    [rows],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const page = rows[row];

      if (page) {
        navigate(pageUrl(page.id));
      }
    },
    [rows, navigate],
  );

  const handleRowSelectionChange = useCallback(
    (selectedRows: number[], clearSelection: () => void) => {
      const ids = selectedRows.flatMap((index) => {
        const page = rows[index];

        return page ? [page.id] : [];
      });

      onSelectedPageIdsChange?.(ids, clearSelection);
    },
    [rows, onSelectedPageIdsChange],
  );

  const handleHeaderClick = useCallback(
    (col: number) => {
      const columnId = availableColumns[col]?.id;

      switch (columnId) {
        case SortField.title:
        case SortField.slug:
        case SortField.visible:
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
        emptyText={intl.formatMessage(messages.empty)}
        onHeaderClicked={handleHeaderClick}
        rowAnchor={handleRowAnchor}
        onRowClick={handleRowClick}
        onRowSelectionChange={handleRowSelectionChange}
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
