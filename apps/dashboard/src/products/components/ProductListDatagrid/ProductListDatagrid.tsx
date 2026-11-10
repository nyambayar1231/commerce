// Adapted from saleor-dashboard: src/products/components/ProductListDatagrid/ProductListDatagrid.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list grid: Saleor's columns with sort arrows (header click sorts), checkbox row
// markers, row link to the product, loading/empty states and the pagination footer. Not yet:
// bulk actions behind the row checkboxes (M2.4), the column picker (M2.2.6), tiles view.
import type { Item } from "@glideapps/glide-data-grid";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { Datagrid } from "../../../components/Datagrid/Datagrid";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import type { ProductListRowFragment } from "../../../graphql/types.generated";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import type { Sort } from "../../../utils/columns/getColumnSortDirectionIcon";
import {
  type ProductListUrlSortField,
  productUrl,
  ProductListUrlSortField as SortField,
} from "../../urls";
import { createGetCellContent, productListStaticColumnsAdapter } from "./datagrid";
import { messages } from "./messages";

interface ProductListDatagridProps {
  rows: ProductListRowFragment[];
  disabled: boolean;
  sort?: Sort<ProductListUrlSortField>;
  onSort?: (field: ProductListUrlSortField) => void;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
}

export const ProductListDatagrid = ({
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
}: ProductListDatagridProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const availableColumns = useMemo(() => productListStaticColumnsAdapter(intl, sort), [intl, sort]);

  const getCellContent = useMemo(
    () => createGetCellContent(rows, availableColumns, { intl }),
    [rows, availableColumns, intl],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const product = rows[row];

      return product ? productUrl(product.id) : "";
    },
    [rows],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const product = rows[row];

      if (product) {
        navigate(productUrl(product.id));
      }
    },
    [rows, navigate],
  );

  const handleHeaderClick = useCallback(
    (col: number) => {
      const columnId = availableColumns[col]?.id;

      switch (columnId) {
        case SortField.name:
        case SortField.availability:
        case SortField.price:
        case SortField.date:
        case SortField.created:
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
