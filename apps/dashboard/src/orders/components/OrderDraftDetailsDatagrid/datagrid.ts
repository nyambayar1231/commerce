// Adapted from saleor-dashboard: src/orders/components/OrderDraftDetailsDatagrid/datagrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The draft lines grid's columns in Saleor's order and widths, and its cells: product (thumbnail
// + name), status, SKU, variant, quantity (an editable number cell), price and total. Left out
// with discounts, gifts and metadata: Saleor's empty spacer column, "is gift" and the discounted
// price. Status is one pill (Saleor: a tags cell from @glideapps/glide-data-grid-cells, which we
// don't ship): Finalize's error for the line, else "Product no longer exists".
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { DefaultTheme } from "@saleor/macaw-ui";
import type { IntlShape } from "react-intl";

import {
  moneyCell,
  numberCell,
  pillCell,
  readonlyTextCell,
  thumbnailCell,
} from "../../../components/Datagrid/customCells/cells";
import type { NumberCellProps } from "../../../components/Datagrid/customCells/NumberCell";
import type { GetCellContentOpts } from "../../../components/Datagrid/Datagrid";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { OrderErrorFragment, OrderLineFragment } from "../../../graphql/types.generated";
import { getStatusColor } from "../../../misc";
import { getOrderErrorMessage } from "../../../utils/errors";
import { columnsMessages, lineAlertMessages } from "./messages";

export const orderDraftDetailsStaticColumnsAdapter = (intl: IntlShape): AvailableColumn[] => [
  { id: "product", title: intl.formatMessage(columnsMessages.product), width: 300 },
  { id: "status", title: intl.formatMessage(columnsMessages.status), width: 250 },
  { id: "sku", title: "SKU", width: 150 },
  { id: "variantName", title: intl.formatMessage(columnsMessages.variantName), width: 150 },
  { id: "quantity", title: intl.formatMessage(columnsMessages.quantity), width: 80 },
  { id: "price", title: intl.formatMessage(columnsMessages.price), width: 160 },
  { id: "total", title: intl.formatMessage(columnsMessages.total), width: 160 },
];

interface OrderLineStatus {
  type: "warning" | "error";
  status: string;
}

/** Saleor's getOrderLineStatus, minus "not available for purchase" (no availability dates). */
export const getOrderLineStatus = (
  intl: IntlShape,
  line: OrderLineFragment,
  error?: OrderErrorFragment,
): OrderLineStatus[] => {
  const statuses: OrderLineStatus[] = [];

  if (error) {
    statuses.push({
      type: "error",
      status: getOrderErrorMessage(error, intl) ?? error.message ?? "",
    });
  }

  if (!line.variant) {
    statuses.push({ type: "warning", status: intl.formatMessage(lineAlertMessages.notExists) });
  }

  return statuses;
};

const readonlyOptions: Partial<GridCell> = { readonly: true, allowOverlay: false };

export const createGetCellContent =
  ({
    columns,
    lines,
    errors,
    intl,
    theme,
  }: {
    columns: AvailableColumn[];
    lines: OrderLineFragment[];
    errors: OrderErrorFragment[];
    intl: IntlShape;
    theme: DefaultTheme;
  }) =>
  ([column, row]: Item, { changes, getChangeIndex }: GetCellContentOpts): GridCell => {
    const columnId = columns[column]?.id;
    const line = lines[row];

    if (!columnId || !line) {
      return readonlyTextCell("", false);
    }

    const change = changes.current[getChangeIndex(columnId, row)]?.data as
      | NumberCellProps
      | undefined;

    switch (columnId) {
      case "product":
        return thumbnailCell(
          line.productName,
          line.variant?.product.thumbnail?.url ?? "",
          readonlyOptions,
        );
      case "status": {
        const error = errors.find((candidate) => candidate.orderLines?.includes(line.id));
        const [status] = getOrderLineStatus(intl, line, error);

        return status
          ? pillCell(
              status.status,
              getStatusColor({ status: status.type, currentTheme: theme }),
              readonlyOptions,
            )
          : readonlyTextCell("", false);
      }
      case "sku":
        return readonlyTextCell(line.productSku ?? "", false);
      case "variantName":
        return readonlyTextCell(line.variantName ?? "", false);
      case "quantity":
        return numberCell(change?.value ?? line.quantity);
      case "price":
        return moneyCell(
          line.unitPrice.gross.amount,
          line.unitPrice.gross.currency,
          readonlyOptions,
        );
      case "total":
        return moneyCell(
          line.totalPrice.gross.amount,
          line.totalPrice.gross.currency,
          readonlyOptions,
        );
      default:
        return readonlyTextCell("", false);
    }
  };
