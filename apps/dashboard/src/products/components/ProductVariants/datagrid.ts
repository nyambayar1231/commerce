// Adapted from saleor-dashboard: src/products/components/ProductVariants/datagrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variants card's columns, in Saleor's order and widths: name, SKU, price, then one per
// warehouse (Saleor's parseWarehousesColumns) titled with the warehouse's name. Our single channel
// replaces Saleor's per-channel columns, so the price is one plain read-only cell. A warehouse
// column shows the variant's quantity there, empty when the variant has no stock row in it; empty
// names and SKUs render as empty cells.
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import { readonlyTextCell } from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { ProductDetailsFragment } from "../../../graphql/types.generated";
import { formatPrice } from "../ProductListDatagrid/datagrid";
import { messages } from "./messages";

export type ProductVariantRow = ProductDetailsFragment["variants"][number];

export const variantsStaticColumns = (intl: IntlShape): AvailableColumn[] => [
  {
    id: "name",
    title: intl.formatMessage(messages.name),
    width: 200,
  },
  {
    id: "sku",
    title: intl.formatMessage(messages.sku),
    width: 200,
  },
  {
    id: "price",
    title: intl.formatMessage(messages.price),
    width: 150,
  },
];

const WAREHOUSE_COLUMN_PREFIX = "warehouse:";

/** Saleor's parseWarehousesColumns: one column per warehouse, keyed by its id. */
export const parseWarehousesColumns = (
  warehouses: { id: string; name: string }[],
): AvailableColumn[] =>
  warehouses.map((warehouse) => ({
    id: `${WAREHOUSE_COLUMN_PREFIX}${warehouse.id}`,
    title: warehouse.name,
    width: 150,
  }));

export const createGetCellContent =
  (rows: ProductVariantRow[], columns: AvailableColumn[], intl: IntlShape) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const variant = rows[row];

    if (!columnId || !variant) {
      return readonlyTextCell("", false);
    }

    if (columnId.startsWith(WAREHOUSE_COLUMN_PREFIX)) {
      const warehouseId = columnId.slice(WAREHOUSE_COLUMN_PREFIX.length);
      const stock = (variant.stocks ?? []).find((item) => item.warehouse.id === warehouseId);

      return readonlyTextCell(stock === undefined ? "" : String(stock.quantity));
    }

    switch (columnId) {
      case "name":
        return readonlyTextCell(variant.name);
      case "sku":
        return readonlyTextCell(variant.sku ?? "");
      case "price":
        return readonlyTextCell(formatPrice(intl, variant.price));
      default:
        return readonlyTextCell("", false);
    }
  };
