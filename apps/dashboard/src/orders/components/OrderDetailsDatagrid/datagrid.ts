// Adapted from saleor-dashboard: src/orders/components/OrderDetailsDatagrid/datagrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order lines grid's columns in Saleor's order and widths: product (thumbnail + name), SKU,
// variant, quantity, price and total. Saleor's empty spacer column, "is gift", price-override and
// reason columns, discounted prices and the price breakdown are left out (no discounts or
// overrides in our orders). The variant column shows the name copied onto the line.
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import {
  moneyCell,
  readonlyTextCell,
  thumbnailCell,
} from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { OrderLineFragment } from "../../../graphql/types.generated";
import { columnsMessages } from "./messages";

export const orderDetailsStaticColumnsAdapter = (intl: IntlShape): AvailableColumn[] => [
  { id: "product", title: intl.formatMessage(columnsMessages.product), width: 300 },
  { id: "sku", title: intl.formatMessage(columnsMessages.sku), width: 150 },
  { id: "variantName", title: intl.formatMessage(columnsMessages.variantName), width: 150 },
  { id: "quantity", title: intl.formatMessage(columnsMessages.quantity), width: 80 },
  { id: "price", title: intl.formatMessage(columnsMessages.price), width: 160 },
  { id: "total", title: intl.formatMessage(columnsMessages.total), width: 160 },
];

const readonlyOptions: Partial<GridCell> = { cursor: "default" };

/** Saleor's toLineWithUnfulfilledQuantity: the unfulfilled card counts what is left to fulfil. */
export const toLineWithUnfulfilledQuantity = (lines: OrderLineFragment[]): OrderLineFragment[] =>
  lines
    .map((line) => ({ ...line, quantity: line.quantity - line.quantityFulfilled }))
    .filter((line) => line.quantity > 0);

export const createGetCellContent =
  (columns: AvailableColumn[], lines: OrderLineFragment[]) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const line = lines[row];

    if (!columnId || !line) {
      return readonlyTextCell("", false);
    }

    switch (columnId) {
      case "product":
        return thumbnailCell(
          line.productName,
          line.variant?.product.thumbnail?.url ?? "",
          readonlyOptions,
        );
      case "sku":
        return readonlyTextCell(line.productSku ?? "", false);
      case "variantName":
        return readonlyTextCell(line.variantName || "-", false);
      case "quantity":
        return readonlyTextCell(line.quantity.toString(), false);
      case "price":
        return moneyCell(
          line.unitPrice.gross.amount,
          line.unitPrice.gross.currency,
          readonlyOptions,
        );
      case "total":
        // Saleor's unfulfilled card shows the line's own total, not quantity × price of what is left.
        return moneyCell(
          line.totalPrice.gross.amount,
          line.totalPrice.gross.currency,
          readonlyOptions,
        );
      default:
        return readonlyTextCell("", false);
    }
  };
