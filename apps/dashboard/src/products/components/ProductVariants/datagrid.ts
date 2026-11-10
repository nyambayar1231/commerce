// Adapted from saleor-dashboard: src/products/components/ProductVariants/datagrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variants card's three columns, in Saleor's order and widths: name, SKU and price. Our single
// channel replaces Saleor's per-channel columns, so the price is one plain read-only cell. Empty
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

export const createGetCellContent =
  (rows: ProductVariantRow[], columns: AvailableColumn[], intl: IntlShape) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const variant = rows[row];

    if (!columnId || !variant) {
      return readonlyTextCell("", false);
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
