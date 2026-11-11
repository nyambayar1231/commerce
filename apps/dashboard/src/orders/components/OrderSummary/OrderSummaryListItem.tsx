// Adapted from saleor-dashboard: src/orders/components/OrderSummary/OrderSummaryListItem.tsx and
// OrderSummaryListAmount.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A summary row: label on the left, amount on the right. Saleor prints two minor digits; amounts
// here have none (MNT, ADR-0013), as everywhere else in the dashboard.
import { Box, Text, type TextProps } from "@saleor/macaw-ui";
import type { CSSProperties, ReactNode } from "react";
import { useIntl } from "react-intl";

const tabularNumsStyle: CSSProperties = { fontVariantNumeric: "tabular-nums" };

export const OrderSummaryListAmount = ({
  amount,
  showSign = false,
  ...props
}: Omit<TextProps, "children"> & { amount: number; showSign?: boolean }) => {
  const intl = useIntl();

  return (
    <Text fontWeight="regular" style={tabularNumsStyle} {...props}>
      {intl.formatNumber(amount, {
        maximumFractionDigits: 0,
        signDisplay: showSign ? "exceptZero" : "auto",
      })}
    </Text>
  );
};

interface OrderSummaryListItemProps {
  children: ReactNode;
  amount: number;
  showSign?: boolean;
  currency?: string;
  amountTitle?: string;
  bold?: boolean;
  alignItems?: "baseline" | "start";
  "data-test-id"?: string;
}

export const OrderSummaryListItem = ({
  children,
  amount,
  showSign,
  currency,
  amountTitle,
  bold = false,
  alignItems = "baseline",
  ...rest
}: OrderSummaryListItemProps) => {
  const fontWeight = bold ? "bold" : "regular";

  return (
    <Box
      as="li"
      display="grid"
      __gridTemplateColumns="minmax(0, 1fr) auto"
      alignItems={alignItems}
      gap={2}
      __minWidth={0}
      data-test-id={rest["data-test-id"]}
    >
      <Box fontSize={4} lineHeight={4} letterSpacing={4} fontWeight={fontWeight} color="default1">
        {children}
      </Box>
      <Box title={amountTitle}>
        <Text fontWeight={fontWeight} color="default2" size={3}>
          {currency}
        </Text>{" "}
        <OrderSummaryListAmount
          amount={amount}
          showSign={showSign}
          size={4}
          fontWeight={fontWeight}
          data-test-id="amount"
        />
      </Box>
    </Box>
  );
};
