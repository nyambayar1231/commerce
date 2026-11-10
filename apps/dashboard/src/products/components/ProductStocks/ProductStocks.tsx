// Adapted from saleor-dashboard: src/products/components/ProductStocks/ProductStocks.tsx and
// src/products/components/ProductStocks/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The Inventory card, reduced to the SKU input and the "Track Inventory" checkbox with Saleor's
// helper text. The per-warehouse stock table, assign-warehouse dialog, channel allocation hint and
// spreadsheet paste come with stocks/warehouses (M3).
import { Box, Checkbox, Input, Text } from "@saleor/macaw-ui";
import type * as React from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";

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
});

interface ProductStocksProps {
  sku: string;
  trackInventory: boolean;
  disabled: boolean;
  errors: ProductErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTrackInventoryChange: (trackInventory: boolean) => void;
}

export const ProductStocks = ({
  sku,
  trackInventory,
  disabled,
  errors,
  onChange,
  onTrackInventoryChange,
}: ProductStocksProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["sku"], errors);

  return (
    <DetailSettingsCard title={intl.formatMessage(messages.title)} data-test-id="variant-inventory">
      <Box __width="50%">
        <Input
          data-test-id="variant-sku-input"
          label={intl.formatMessage(messages.sku)}
          name="sku"
          disabled={disabled}
          value={sku}
          onChange={onChange}
          error={!!formErrors.sku}
          helperText={getProductErrorMessage(formErrors.sku, intl)}
        />
      </Box>
      <Box paddingTop={5}>
        <Checkbox
          data-test-id="variant-track-inventory"
          checked={trackInventory}
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
    </DetailSettingsCard>
  );
};

ProductStocks.displayName = "ProductStocks";
