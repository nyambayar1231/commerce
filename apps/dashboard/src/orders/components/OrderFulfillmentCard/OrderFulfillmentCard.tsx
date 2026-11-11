// Adapted from saleor-dashboard: src/orders/components/OrderFulfillmentCard/OrderFulfillmentCard.tsx,
// OrderCardTitle/OrderCardTitle.tsx, StatusIndicator.tsx and messages.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A fulfillment: its date and warehouse above "Fulfilled #n" with Saleor's green package icon, then
// its lines in the order lines grid (each with the fulfilled quantity). Left out (PLAN M6 decision
// 2): tracking numbers, approval, fulfillment cancel and its menu, refund navigation, metadata,
// reasons and the returned/refunded statuses.
import { Box, Text } from "@saleor/macaw-ui";
import { PackageIcon } from "lucide-react";
import { useMemo } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import type { FulfillmentFragment } from "../../../graphql/types.generated";
import { getStatusColor } from "../../../misc";
import { useTheme } from "../../../theme/hook";
import { OrderDetailsDatagrid } from "../OrderDetailsDatagrid/OrderDetailsDatagrid";

const fulfilledMessage = defineMessage({
  id: "16iwCI",
  defaultMessage: "Fulfilled",
  description: "section header",
});
const fromWarehouseMessage = defineMessage<{ warehouseName: string }>({
  id: "W2glWk",
  defaultMessage: "From {warehouseName}",
  description: "fulfilled fulfillment, warehouse info",
});

const StatusIndicator = () => {
  const intl = useIntl();
  const { theme } = useTheme();
  const { base, border, text } = getStatusColor({ status: "success", currentTheme: theme });

  return (
    <Box
      marginLeft={2}
      display="flex"
      placeItems="center"
      aria-label={intl.formatMessage(fulfilledMessage)}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        borderRadius="100%"
        borderStyle="solid"
        borderWidth={1}
        __width="28px"
        __height="28px"
        __backgroundColor={base}
        __borderColor={border}
      >
        <PackageIcon color={text} size={16} />
      </Box>
    </Box>
  );
};

export const OrderFulfillmentCard = ({ fulfillment }: { fulfillment: FulfillmentFragment }) => {
  const intl = useIntl();
  // Saleor's fulfillmentLineToLine: the line, with the quantity this fulfillment shipped.
  const lines = useMemo(
    () =>
      (fulfillment.lines ?? []).flatMap((line) =>
        line.orderLine ? [{ ...line.orderLine, quantity: line.quantity }] : [],
      ),
    [fulfillment.lines],
  );
  const created = typeof fulfillment.created === "string" ? new Date(fulfillment.created) : null;

  return (
    <Box backgroundColor="default2" data-test-id="fulfilled-order-section">
      <Box paddingX={6} paddingTop={5} paddingBottom={4}>
        <Box display="flex" gap={3} alignItems="center">
          {created && (
            <Text color="default2" size={2}>
              {intl.formatDate(created, {
                day: "numeric",
                month: "short",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}
          {fulfillment.warehouse && (
            <Text color="default2" size={2}>
              <FormattedMessage
                {...fromWarehouseMessage}
                values={{ warehouseName: fulfillment.warehouse.name }}
              />
            </Text>
          )}
        </Box>
        <Box display="flex" alignItems="center" marginTop={1}>
          <Text size={6} fontWeight="medium">
            <FormattedMessage {...fulfilledMessage} /> #{fulfillment.fulfillmentOrder}
          </Text>
          <StatusIndicator />
        </Box>
      </Box>
      {lines.length > 0 && <OrderDetailsDatagrid lines={lines} />}
    </Box>
  );
};
