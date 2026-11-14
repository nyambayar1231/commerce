// Adapted from saleor-dashboard: src/orders/components/OrderDraftDetailsDatagrid/
// OrderDraftDetailsDatagrid.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The draft's lines as Saleor's editable grid: the quantity is edited in its cell (double-click,
// Enter or just type a number) and saved as soon as the cell is left; the column picker resizes,
// reorders and hides columns; each row's "⋮" menu opens the product in a new tab or removes the
// line after Saleor's "Remove product" confirmation. Left out with discounts and metadata: the
// "Add/Edit discount" menu item and price-cell click, the metadata button and Saleor's discount
// ripple.
import { Box, useTheme } from "@saleor/macaw-ui";
import { ExternalLink, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";

import type { ConfirmButtonTransitionState } from "../../../components/ConfirmButton/ConfirmButton";
import { ColumnPicker } from "../../../components/Datagrid/ColumnPicker/ColumnPicker";
import { useColumns } from "../../../components/Datagrid/ColumnPicker/useColumns";
import type { RowActionItem } from "../../../components/Datagrid/components/RowActions";
import { numberCellEmptyValue } from "../../../components/Datagrid/customCells/NumberCell";
import { Datagrid } from "../../../components/Datagrid/Datagrid";
import {
  type DatagridChangeOpts,
  DatagridChangeStateContext,
  useDatagridChangeState,
} from "../../../components/Datagrid/hooks/useDatagridChange";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import type { OrderErrorFragment, OrderLineFragment } from "../../../graphql/types.generated";
import useListSettings, {
  ORDER_DRAFT_DETAILS_DEFAULT_COLUMNS,
} from "../../../hooks/useListSettings";
import { productUrl } from "../../../products/urls";
import { OrderDraftLineRemoveDialog } from "../OrderDraftLineRemoveDialog/OrderDraftLineRemoveDialog";
import { createGetCellContent, orderDraftDetailsStaticColumnsAdapter } from "./datagrid";
import { messages } from "./messages";

interface OrderDraftDetailsDatagridProps {
  lines: OrderLineFragment[];
  /** Finalize's errors about the lines; each shows in its line's status cell. */
  errors: OrderErrorFragment[];
  orderLineRemoveConfirmState?: ConfirmButtonTransitionState;
  orderLineRemoveErrors?: OrderErrorFragment[];
  /** Saves a line's new quantity; resolves once the draft is updated. */
  onOrderLineChange: (lineId: string, quantity: number) => Promise<unknown>;
  /** Removes a line; resolves to true when it is gone (the dialog then closes). */
  onOrderLineRemove: (lineId: string) => Promise<boolean>;
}

export const OrderDraftDetailsDatagrid = ({
  lines,
  errors,
  orderLineRemoveConfirmState = "default",
  orderLineRemoveErrors = [],
  onOrderLineChange,
  onOrderLineRemove,
}: OrderDraftDetailsDatagridProps) => {
  const intl = useIntl();
  const { theme } = useTheme();
  const datagrid = useDatagridChangeState();
  const { updateListSettings, settings } = useListSettings("ORDER_DRAFT_DETAILS_LIST");
  const [lineToRemoveId, setLineToRemoveId] = useState<string | null>(null);
  const lineToRemove = lines.find((line) => line.id === lineToRemoveId);

  const staticColumnsMemo = useMemo(() => orderDraftDetailsStaticColumnsAdapter(intl), [intl]);
  const handleColumnChange = useCallback(
    (picked: string[]) => updateListSettings("columns", picked.filter(Boolean)),
    [updateListSettings],
  );
  const { handlers, visibleColumns, staticColumns, selectedColumns, recentlyAddedColumn } =
    useColumns({
      gridName: "order_draft_details_products",
      staticColumns: staticColumnsMemo,
      selectedColumns: settings?.columns ?? ORDER_DRAFT_DETAILS_DEFAULT_COLUMNS,
      onSave: handleColumnChange,
    });
  const getCellContent = useMemo(
    () => createGetCellContent({ columns: visibleColumns, lines, errors, intl, theme }),
    [visibleColumns, lines, errors, intl, theme],
  );

  const getMenuItems = useCallback(
    (index: number): RowActionItem[] => {
      const productId = lines[index]?.variant?.product.id;

      return [
        {
          label: intl.formatMessage(messages.productDetails),
          testId: "open-product-details",
          disabled: !productId,
          icon: <ExternalLink size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
          onSelect: () => {
            if (productId) {
              window.open(productUrl(productId), "_blank", "noopener,noreferrer");
            }
          },
        },
        {
          label: intl.formatMessage(messages.deleteOrder),
          testId: "delete-order-line",
          color: "critical1",
          icon: <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
          onSelect: () => setLineToRemoveId(lines[index]?.id ?? null),
        },
      ];
    },
    [intl, lines],
  );

  const handleDatagridChange = useCallback(
    async (
      { currentUpdate }: DatagridChangeOpts,
      setMarkCellsDirty: (areCellsDirty: boolean) => void,
    ) => {
      if (!currentUpdate) return;

      const { data, column, row } = currentUpdate;
      const line = lines[row];
      const value = (data as { value?: number | typeof numberCellEmptyValue } | undefined)?.value;

      // Saleor saves any non-empty quantity; ours also skips an unchanged or non-whole number,
      // and an empty cell goes back to the saved quantity.
      if (
        line &&
        column === "quantity" &&
        value !== numberCellEmptyValue &&
        typeof value === "number" &&
        Number.isInteger(value) &&
        value !== line.quantity
      ) {
        await onOrderLineChange(line.id, value);
      }

      datagrid.changes.current = [];
      setMarkCellsDirty(false);
    },
    [datagrid.changes, lines, onOrderLineChange],
  );

  const handleConfirmRemove = useCallback(async () => {
    if (lineToRemoveId && (await onOrderLineRemove(lineToRemoveId))) {
      setLineToRemoveId(null);
    }
  }, [lineToRemoveId, onOrderLineRemove]);

  return (
    <DatagridChangeStateContext.Provider value={datagrid}>
      <Box data-test-id="draft-order-lines-grid">
        <Datagrid
          rowMarkers="none"
          columnSelect="single"
          freezeColumns={1}
          verticalBorder={false}
          showTopBorder={false}
          availableColumns={visibleColumns}
          emptyText={intl.formatMessage(messages.emptyText)}
          getCellContent={getCellContent}
          menuItems={getMenuItems}
          rows={lines.length}
          onColumnResize={handlers.onResize}
          onColumnMoved={handlers.onMove}
          recentlyAddedColumn={recentlyAddedColumn}
          onClearRecentlyAddedColumn={handlers.onClearRecentlyAddedColumn}
          renderColumnPicker={() => (
            <ColumnPicker
              selectedColumns={selectedColumns}
              staticColumns={staticColumns}
              onToggle={handlers.onToggle}
            />
          )}
          onChange={handleDatagridChange}
        />
      </Box>
      <OrderDraftLineRemoveDialog
        confirmButtonState={orderLineRemoveConfirmState}
        errors={orderLineRemoveErrors}
        open={lineToRemoveId !== null}
        productName={
          lineToRemove?.productName ?? intl.formatMessage(messages.unknownProductFallback)
        }
        onClose={() => setLineToRemoveId(null)}
        onConfirm={() => void handleConfirmRemove()}
      />
    </DatagridChangeStateContext.Provider>
  );
};
