// Adapted from saleor-dashboard: src/components/QuantityInput.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A number input with Saleor's "/ {max}" suffix, right-aligned, red when over the maximum.
import { Input, type InputProps, Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { FormattedMessage } from "react-intl";

interface QuantityInputProps extends Omit<InputProps, "value" | "max"> {
  value: number;
  max: number;
  isError?: boolean;
  outOf?: ReactNode;
}

export const QuantityInput = ({ value, max, isError, outOf, ...props }: QuantityInputProps) => (
  <Input
    {...props}
    type="number"
    __minWidth="40px"
    width="100%"
    value={value}
    endAdornment={
      <Text minWidth={max > 9 ? 10 : 7} paddingRight={2}>
        {outOf ?? (
          <FormattedMessage
            id="CWDuMj"
            defaultMessage="/ {max}"
            description="remaining quantity"
            values={{ max }}
          />
        )}
      </Text>
    }
    max={max}
    min={0}
    textAlign="right"
    error={isError}
  />
);
