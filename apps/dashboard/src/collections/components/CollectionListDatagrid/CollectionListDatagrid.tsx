// Adapted from saleor-dashboard: src/collections/components/CollectionListDatagrid/CollectionListDatagrid.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The list grid: columns with sort arrows (header click sorts), row link to the collection, checkbox
// row markers, row selection and the pagination footer. Saleor's column picker, its channel tooltip
// (one channel) and the "no filter selected" sort gate are left out.
import type { Item } from "@glideapps/glide-data-grid";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import type { CollectionListRowFragment } from "../../../graphql/types.generated";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import {
  type CollectionListUrlSortField,
  collectionUrl,
  CollectionListUrlSortField as SortField,
} from "../../urls";
import { collectionListStaticColumnsAdapter, createGetCellContent } from "./datagrid";
import { messages } from "./messages";

interface CollectionListDatagridProps {
  rows: CollectionListRowFragment[];
  disabled: boolean;
  sort?: Sort<CollectionListUrlSortField>;
  onSort?: (field: CollectionListUrlSortField) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
  /** Selected collection ids, plus a callback that clears the grid's selection. */
  onSelectedCollectionIdsChange?: (ids: string[], clearSelection: () => void) => void;
}

export const CollectionListDatagrid = ({
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
  onSelectedCollectionIdsChange,
}: CollectionListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const availableColumns = useMemo(
    () => collectionListStaticColumnsAdapter(intl, sort),
    [intl, sort],
  );
  const getCellContent = useMemo(
    () => createGetCellContent(rows, availableColumns, { intl }),
    [rows, availableColumns, intl],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const collection = rows[row];

      return collection ? collectionUrl(collection.id) : "";
    },
    [rows],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const collection = rows[row];

      if (collection) {
        navigate(collectionUrl(collection.id));
      }
    },
    [rows, navigate],
  );

  const handleRowSelectionChange = useCallback(
    (selectedRows: number[], clearSelection: () => void) => {
      const ids = selectedRows.flatMap((index) => {
        const collection = rows[index];

        return collection ? [collection.id] : [];
      });

      onSelectedCollectionIdsChange?.(ids, clearSelection);
    },
    [rows, onSelectedCollectionIdsChange],
  );

  const handleHeaderClick = useCallback(
    (col: number) => {
      const columnId = availableColumns[col]?.id;

      switch (columnId) {
        case SortField.name:
        case SortField.productCount:
        case SortField.availability:
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
