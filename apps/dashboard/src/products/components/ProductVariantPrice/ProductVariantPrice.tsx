// Adapted from saleor-dashboard: src/products/components/ProductVariantPrice/ProductVariantPrice.tsx
// and src/products/components/ProductVariantPrice/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The Pricing card, reduced to our single channel (ADR-0005): one price input with the channel's
// currency as its end adornment. Saleor's channel table, cost price, prior price, availability
// toggle, manage-channels dialog and spreadsheet paste are not on the page yet.
import { Box, Input, Text } from "@saleor/macaw-ui";
import type * as React from "react";
import { defineMessages, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";

const messages = defineMessages({
  title: {
    id: "Xm9qOu",
    defaultMessage: "Pricing",
    description: "product pricing, section header",
  },
  price: {
    id: "4hl9rS",
    defaultMessage: "Price",
    description: "variant price in channel",
  },
});

interface ProductVariantPriceProps {
  value: string;
  /** The shop's currency, shown after the amount (MNT until channels exist). */
  currency: string;
  disabled: boolean;
  errors: ProductErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProductVariantPrice = ({
  value,
  currency,
  disabled,
  errors,
  onChange,
}: ProductVariantPriceProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["price"], errors);

  return (
    <DetailSettingsCard title={intl.formatMessage(messages.title)} data-test-id="variant-pricing">
      <Box __width="50%">
        <Input
          data-test-id="variant-price-input"
          type="text"
          inputMode="decimal"
          label={intl.formatMessage(messages.price)}
          name="price"
          disabled={disabled}
          value={value}
          onChange={onChange}
          error={!!formErrors.price}
          helperText={getProductErrorMessage(formErrors.price, intl)}
          endAdornment={
            <Text size={2} color="default2">
              {currency}
            </Text>
          }
        />
      </Box>
    </DetailSettingsCard>
  );
};

ProductVariantPrice.displayName = "ProductVariantPrice";
