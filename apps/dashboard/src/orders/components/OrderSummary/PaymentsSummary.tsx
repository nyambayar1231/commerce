// Adapted from saleor-dashboard: src/orders/components/OrderSummary/PaymentsSummary.tsx,
// PaymentsSummaryHeader.tsx, PaymentsSummaryEmptyState.tsx, OrderChargeStatusBadge.tsx and
// OrderAuthorizeStatusBadge.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Payments summary": the charge/authorize badges and the captured, authorized and outstanding
// amounts, or Saleor's empty state when the order has no transaction (Saleor's hasNoPayment, which
// for us — no legacy payments, gift cards or granted refunds — is "no transactions").
import { Box, Text } from "@saleor/macaw-ui";
import { BanknoteIcon, CreditCard } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";

import { Pill } from "../../../components/Pill/Pill";
import type {
  OrderAuthorizeStatusEnum,
  OrderChargeStatusEnum,
  OrderDetailsFragment,
} from "../../../graphql/types.generated";
import { OrderSummaryListItem } from "./OrderSummaryListItem";

const OrderChargeStatusBadge = ({ status }: { status: OrderChargeStatusEnum }) => {
  const intl = useIntl();

  switch (status) {
    case "FULL":
      return (
        <Pill
          color="success"
          icon={<BanknoteIcon size={16} />}
          label={intl.formatMessage({ defaultMessage: "Fully charged", id: "Ynjq+C" })}
        />
      );
    case "OVERCHARGED":
      return (
        <Pill
          color="attention"
          label={intl.formatMessage({ defaultMessage: "Overcharged", id: "8Cjxdt" })}
        />
      );
    default:
      return (
        <Pill
          color="neutral"
          label={intl.formatMessage({ defaultMessage: "Not fully charged", id: "X9tptP" })}
        />
      );
  }
};

const OrderAuthorizeStatusBadge = ({ status }: { status: OrderAuthorizeStatusEnum }) => {
  const intl = useIntl();

  switch (status) {
    case "FULL":
      return (
        <Pill
          color="success"
          label={intl.formatMessage({ defaultMessage: "Fully authorised", id: "wVjyOX" })}
        />
      );
    case "NONE":
      return (
        <Pill
          color="neutral"
          label={intl.formatMessage({ defaultMessage: "Not fully authorised", id: "l1pZJx" })}
        />
      );
    default:
      return null;
  }
};

const PaymentsSummaryHeader = ({ description }: { description?: string }) => (
  <Box display="flex" flexDirection="column">
    <Text fontWeight="medium" fontSize={6}>
      <FormattedMessage defaultMessage="Payments summary" id="q7bXR4" />
    </Text>
    {description && (
      <Text color="default2" size={2} marginTop={1}>
        {description}
      </Text>
    )}
  </Box>
);

const PaymentsSummaryEmptyState = () => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    paddingX={4}
    paddingY={8}
  >
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      width={14}
      height={14}
      borderRadius="100%"
      backgroundColor="default2"
      color="default2"
    >
      <CreditCard size={24} stroke="currentColor" />
    </Box>
    <Box display="flex" flexDirection="column" alignItems="center" gap={1} textAlign="center">
      <Text size={4} fontWeight="medium">
        <FormattedMessage defaultMessage="No payment received" id="6Jgwpc" />
      </Text>
      <Text color="default2" size={2}>
        <FormattedMessage
          defaultMessage="Mark as paid manually if the payment is confirmed"
          id="3Eyq0y"
        />
      </Text>
    </Box>
  </Box>
);

type PaymentsSummaryProps = Pick<
  OrderDetailsFragment,
  | "chargeStatus"
  | "authorizeStatus"
  | "totalCharged"
  | "totalAuthorized"
  | "totalBalance"
  | "transactions"
>;

export const PaymentsSummary = (order: PaymentsSummaryProps) => {
  const intl = useIntl();
  const boxProps = {
    backgroundColor: "default2",
    padding: 5,
    borderRadius: 4,
    borderStyle: "solid",
    borderColor: "default1",
    borderWidth: 1,
  } as const;

  if (order.transactions.length === 0) {
    return (
      <Box {...boxProps}>
        <PaymentsSummaryHeader />
        <PaymentsSummaryEmptyState />
      </Box>
    );
  }

  return (
    <Box {...boxProps}>
      <PaymentsSummaryHeader
        description={intl.formatMessage({
          defaultMessage: "All payments from registered transactions.",
          id: "9TENcY",
        })}
      />
      <Box marginTop={2} display="flex" gap={3} data-test-id="payment-status-badges">
        <OrderChargeStatusBadge status={order.chargeStatus} />
        <OrderAuthorizeStatusBadge status={order.authorizeStatus} />
      </Box>
      <Box as="ul" display="grid" gap={1} marginTop={4}>
        <OrderSummaryListItem amount={order.totalCharged.amount}>
          <FormattedMessage defaultMessage="Total captured" id="JIQ7KX" />
        </OrderSummaryListItem>
        <OrderSummaryListItem amount={order.totalAuthorized.amount}>
          <FormattedMessage defaultMessage="Outstanding authorized" id="AiurXc" />
        </OrderSummaryListItem>
        <OrderSummaryListItem
          amount={order.totalBalance.amount}
          showSign
          currency={order.totalBalance.currency}
          bold
        >
          <FormattedMessage defaultMessage="Outstanding balance" id="o5GUx9" />
        </OrderSummaryListItem>
      </Box>
    </Box>
  );
};
