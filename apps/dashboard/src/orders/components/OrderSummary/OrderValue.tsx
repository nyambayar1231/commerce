// Adapted from saleor-dashboard: src/orders/components/OrderSummary/OrderValue.tsx and
// OrderValueHeader.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The read-only "Order value" box: subtotal, shipping (with the method name), the total and
// Saleor's "Taxes (included)" row for gross prices. Saleor's editing (shipping method, discounts),
// discount and gift-card rows and the "before discounts" tooltip are left out: our orders have none.
// A draft (M13.7) passes `editable`: Saleor's editable shipping row ("Shipping · Change" over the
// method's name, or "Set shipping method", "No shipping address", "No applicable shipping
// methods").
import { Box, Text } from "@saleor/macaw-ui";
import type { ReactNode } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";

import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { OrderSummaryListAmount, OrderSummaryListItem } from "./OrderSummaryListItem";

export interface EditableShipping {
  hasShippingAddress: boolean;
  hasShippingMethods: boolean;
  onShippingMethodEdit: () => void;
}

type OrderValueProps = Pick<
  OrderDetailsFragment,
  "subtotal" | "shippingPrice" | "shippingMethodName" | "total"
> & { editable?: EditableShipping };

const shippingMessages = defineMessages({
  setShippingMethod: { id: "Dg4Y2p", defaultMessage: "Set shipping method" },
  change: { id: "GiS5VI", defaultMessage: "Change" },
  noShippingMethods: { id: "G+MtyG", defaultMessage: "No applicable shipping methods" },
  noShippingAddress: { id: "Ai4XSg", defaultMessage: "No shipping address" },
});

/** Saleor's ButtonLink: a text button in the accent color. */
const LinkButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <Box
    as="button"
    type="button"
    onClick={onClick}
    padding={0}
    borderWidth={0}
    backgroundColor="transparent"
    cursor="pointer"
    data-test-id="add-shipping-carrier"
  >
    <Text color="accent1" size={3}>
      {children}
    </Text>
  </Box>
);

export const OrderValue = ({
  subtotal,
  shippingPrice,
  shippingMethodName,
  total,
  editable,
}: OrderValueProps) => {
  const intl = useIntl();

  const shippingLabel = () => {
    if (!editable) return <FormattedMessage defaultMessage="Shipping" id="glR0om" />;
    if (shippingMethodName) {
      return (
        <Box display="flex" gap={1} alignItems="baseline">
          <FormattedMessage defaultMessage="Shipping" id="glR0om" />
          {editable.hasShippingMethods && (
            <>
              <Text color="default2">·</Text>
              <LinkButton onClick={editable.onShippingMethodEdit}>
                {intl.formatMessage(shippingMessages.change)}
              </LinkButton>
            </>
          )}
        </Box>
      );
    }
    if (!editable.hasShippingAddress || !editable.hasShippingMethods) {
      return (
        <Text as="span" color="default2">
          {intl.formatMessage(
            editable.hasShippingAddress
              ? shippingMessages.noShippingMethods
              : shippingMessages.noShippingAddress,
          )}
        </Text>
      );
    }
    return (
      <LinkButton onClick={editable.onShippingMethodEdit}>
        {intl.formatMessage(shippingMessages.setShippingMethod)}
      </LinkButton>
    );
  };

  return (
    <Box
      backgroundColor="default2"
      padding={5}
      borderRadius={4}
      borderStyle="solid"
      borderColor="default1"
      borderWidth={1}
      minWidth={0}
    >
      <Box display="flex" flexDirection="column">
        <Text fontWeight="medium" fontSize={6}>
          <FormattedMessage defaultMessage="Order value" id="fL08MU" />
        </Text>
        <Text color="default2" size={2} marginTop={1}>
          <FormattedMessage defaultMessage="All lines as ordered by the client." id="73SSOz" />
        </Text>
      </Box>

      <Box as="ul" display="grid" gap={1} marginTop={4} minWidth={0}>
        <OrderSummaryListItem
          amount={subtotal.gross.amount}
          amountTitle={intl.formatMessage({
            id: "ClUKur",
            defaultMessage: "Sum of all line items",
          })}
          data-test-id="order-subtotal-line"
        >
          <FormattedMessage defaultMessage="Subtotal" id="L8seEc" />
        </OrderSummaryListItem>

        <OrderSummaryListItem
          amount={shippingPrice.gross.amount}
          amountTitle={intl.formatMessage({ id: "MHY5da", defaultMessage: "Shipping cost" })}
          alignItems="start"
        >
          <Box display="flex" flexDirection="column" gap={0.5} __minWidth={0}>
            {shippingLabel()}
            {shippingMethodName && (
              <Text size={3} color="default2" title={shippingMethodName}>
                {shippingMethodName}
              </Text>
            )}
          </Box>
        </OrderSummaryListItem>

        <Box
          display="grid"
          placeItems="end"
          title={intl.formatMessage({ id: "aaj/MI", defaultMessage: "Order total" })}
        >
          <Box
            borderStyle="solid"
            borderColor="default1"
            borderTopWidth={1}
            borderBottomWidth={0}
            borderLeftWidth={0}
            borderRightWidth={0}
          >
            <FormattedMessage
              defaultMessage="{currency} {totalAmount}"
              id="V21v8h"
              values={{
                currency: (
                  <Text fontWeight="bold" color="default2" size={3}>
                    {total.gross.currency}
                  </Text>
                ),
                totalAmount: (
                  <OrderSummaryListAmount
                    amount={total.gross.amount}
                    fontWeight="bold"
                    data-test-id="order-total"
                  />
                ),
              }}
            />
          </Box>
        </Box>

        <OrderSummaryListItem
          amount={total.tax.amount}
          amountTitle={intl.formatMessage({
            id: "fS2rip",
            defaultMessage: "Tax amount",
            description: "tooltip for taxes amount",
          })}
        >
          <FormattedMessage defaultMessage="Taxes " id="HTiAMm" />
          <Text color="default2" fontWeight="medium" size={3}>
            {/* Saleor leaves this English (M11.3). */}
            <FormattedMessage
              defaultMessage="(included)"
              description="order summary, taxes are included in the prices"
              id="HY1ZL6"
            />
          </Text>
        </OrderSummaryListItem>
      </Box>
    </Box>
  );
};
