// Adapted from saleor-dashboard: src/products/components/ProductStocks/ProductStocks.tsx and
// src/products/components/ProductStocks/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The Inventory card: the SKU input, the "Track Inventory" checkbox with Saleor's helper text, and
// the per-warehouse stock table with its Assign Warehouses dialog. Per the M3 owner decisions the
// table and button always show (there is one implicit channel), the empty state keeps Saleor's
// sentence without its "configure a warehouse" link, and the spreadsheet paste is not included.
import { Box, Button, Checkbox, Input, Text } from "@saleor/macaw-ui";
import { Trash2 } from "lucide-react";
import type * as React from "react";
import { useMemo, useState } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import type { ProductErrorFragment, WarehouseFragment } from "../../../graphql/types.generated";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";
import { AssignWarehouseDialog } from "../AssignWarehouseDialog/AssignWarehouseDialog";
import type { ProductVariantStock } from "../ProductVariantPage/form";
import styles from "./ProductStocks.module.css";

const messages = defineMessages({
  title: {
    id: "4qe6hO",
    defaultMessage: "Inventory",
    description: "product stock, section header",
  },
  sku: {
    id: "SM+yG0",
    defaultMessage: "SKU (Stock Keeping Unit)",
    description: "input label",
  },
  stock: {
    id: "vuKrlW",
    defaultMessage: "Stock",
  },
  trackInventory: {
    id: "TjGYna",
    defaultMessage: "Track Inventory",
    description: "product inventory, checkbox",
  },
  trackInventoryDescription: {
    id: "Wyl25+",
    defaultMessage: "Active inventory tracking will automatically calculate changes of stock",
    description: "product inventory, checkbox description",
  },
  warehouseName: {
    id: "ErvPaM",
    defaultMessage: "Warehouse Name",
    description: "header",
  },
  allocated: {
    id: "/C//FB",
    defaultMessage: "Allocated",
    description: "header, allocated product quantity",
  },
  quantity: {
    id: "bp/i0x",
    defaultMessage: "Quantity",
    description: "header",
  },
  assignWarehouses: {
    id: "aRvO6i",
    defaultMessage: "Assign Warehouses",
    description: "button",
  },
  configureWarehouseForVariant: {
    id: "NCp87D",
    defaultMessage:
      "There are no warehouses set up for this variant. To add stock quantity to the variant configure a warehouse or use existing one by clicking button below.",
    description: "no warehouses info",
  },
});

export interface ProductStocksData {
  sku: string;
  trackInventory: boolean;
}

interface ProductStocksProps {
  data: ProductStocksData;
  stocks: ProductVariantStock[];
  warehouses: WarehouseFragment[];
  disabled: boolean;
  errors: ProductErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTrackInventoryChange: (trackInventory: boolean) => void;
  onStockChange: (warehouseId: string, value: string) => void;
  onStockAdd: (warehouseId: string, warehouseName: string) => void;
  onStockDelete: (warehouseId: string) => void;
}

export const ProductStocks = ({
  data,
  stocks,
  warehouses,
  disabled,
  errors,
  onChange,
  onTrackInventoryChange,
  onStockChange,
  onStockAdd,
  onStockDelete,
}: ProductStocksProps) => {
  const intl = useIntl();
  const [isAssignWarehousesOpen, setIsAssignWarehousesOpen] = useState(false);
  const [lastStockRowFocus, setLastStockRowFocus] = useState(false);
  const formErrors = getFormErrors(["sku"], errors);

  // Saleor sorts the table by warehouse name; a newly added row may not be the last one.
  const sortedStocks = useMemo(
    () => [...stocks].sort((left, right) => left.warehouseName.localeCompare(right.warehouseName)),
    [stocks],
  );
  const stockedWarehouseIds = useMemo(
    () => new Set(stocks.map((stock) => stock.warehouseId)),
    [stocks],
  );

  const handleWarehouseStockAdd = (warehouseId: string, warehouseName: string) => {
    onStockAdd(warehouseId, warehouseName);
    setLastStockRowFocus(true);
  };
  const handleStockInputFocus = (input: HTMLInputElement | null) => {
    if (lastStockRowFocus && input) {
      input.focus();
      setLastStockRowFocus(false);
    }
  };

  return (
    <DetailSettingsCard title={intl.formatMessage(messages.title)} data-test-id="variant-inventory">
      <Box __width="50%">
        <Input
          data-test-id="variant-sku-input"
          label={intl.formatMessage(messages.sku)}
          name="sku"
          disabled={disabled}
          value={data.sku}
          onChange={onChange}
          error={!!formErrors.sku}
          helperText={getProductErrorMessage(formErrors.sku, intl)}
        />
      </Box>
      <Box paddingTop={5}>
        <Checkbox
          data-test-id="variant-track-inventory"
          checked={data.trackInventory}
          name="trackInventory"
          disabled={disabled}
          onCheckedChange={(checked) => onTrackInventoryChange(checked === true)}
        >
          <Text>
            <FormattedMessage {...messages.trackInventory} />
          </Text>
        </Checkbox>
        <Box paddingLeft={5} paddingTop={1}>
          <Text size={2} color="default2">
            <FormattedMessage {...messages.trackInventoryDescription} />
          </Text>
        </Box>
      </Box>
      <Box display="grid" gap={2} marginTop={5}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Text size={4} fontWeight="medium" as="h3">
            <FormattedMessage {...messages.stock} />
          </Text>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => setIsAssignWarehousesOpen(true)}
            data-test-id="assign-warehouse-button"
          >
            <FormattedMessage {...messages.assignWarehouses} />
          </Button>
        </Box>
        {stocks.length === 0 ? (
          <Text color="default2">
            <FormattedMessage {...messages.configureWarehouseForVariant} />
          </Text>
        ) : null}
      </Box>
      {stocks.length > 0 ? (
        <Box marginTop={5}>
          <Box className={styles.list} data-test-id="product-variant-stock-list">
            <Box className={styles.headerRow}>
              <Text size={2} color="default2">
                <FormattedMessage {...messages.warehouseName} />
              </Text>
              <Text size={2} color="default2" className={styles.allocatedValue}>
                <FormattedMessage {...messages.allocated} />
              </Text>
              <Text size={2} color="default2">
                <FormattedMessage {...messages.quantity} />
              </Text>
              <span />
            </Box>
            {sortedStocks.map((stock, index) => (
              <Box
                key={stock.warehouseId}
                className={styles.row}
                data-test-id={stock.warehouseName}
              >
                <Text size={3} className={styles.warehouseName} title={stock.warehouseName}>
                  {stock.warehouseName}
                </Text>
                <Text size={3} className={styles.allocatedValue}>
                  {stock.quantityAllocated}
                </Text>
                <div className={styles.inputCell}>
                  <Input
                    data-test-id="stock-input"
                    disabled={disabled}
                    onChange={(event) => onStockChange(stock.warehouseId, event.target.value)}
                    value={stock.quantity}
                    size="small"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    ref={(input) =>
                      sortedStocks.length === index + 1 && handleStockInputFocus(input)
                    }
                  />
                </div>
                <Box className={styles.deleteCell}>
                  <Button
                    type="button"
                    variant="secondary"
                    icon={
                      <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
                    }
                    onClick={() => onStockDelete(stock.warehouseId)}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}

      <AssignWarehouseDialog
        open={isAssignWarehousesOpen}
        warehouses={warehouses}
        excludeContainer={(warehouse) => stockedWarehouseIds.has(warehouse.id)}
        onClose={() => setIsAssignWarehousesOpen(false)}
        onSubmit={(selectedWarehouses) => {
          for (const warehouse of selectedWarehouses) {
            handleWarehouseStockAdd(warehouse.id, warehouse.name);
          }
        }}
      />
    </DetailSettingsCard>
  );
};

ProductStocks.displayName = "ProductStocks";
