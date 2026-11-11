// Adapted from saleor-dashboard: src/orders/components/OrderDetailsPage/Title.tsx and
// src/components/Date/MerchantDate.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Order #n" with its status pill, then "Placed …" with the full date in a tooltip. No channel
// (single channel), so no channel link after the date.
import { Box, Skeleton, Text, Tooltip } from "@saleor/macaw-ui";
import { useIntl } from "react-intl";

import { Pill } from "../../../components/Pill/Pill";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { transformOrderStatus } from "../../../misc";
import { getPlacedDate } from "./placedDate";

export const Title = ({
  order,
}: {
  order?: Pick<OrderDetailsFragment, "number" | "status" | "created">;
}) => {
  const intl = useIntl();

  if (!order) {
    return (
      <Box display="flex" alignItems="center" gap={2}>
        <Skeleton __width="8em" />
        <Skeleton __width="10em" />
      </Box>
    );
  }

  const { localized, status } = transformOrderStatus(order.status, intl);
  const placed = typeof order.created === "string" ? getPlacedDate(order.created, intl) : null;

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Box display="flex" justifyContent="center" alignItems="center">
        {intl.formatMessage(
          { id: "AqXzM2", defaultMessage: "Order #{orderNumber}" },
          { orderNumber: order.number },
        )}
        <Box marginLeft={2}>
          <Pill data-test-id="status-info" label={localized} color={status} />
        </Box>
      </Box>
      {placed && (
        <Tooltip>
          <Tooltip.Trigger>
            <Text
              as="span"
              size={3}
              fontWeight="regular"
              color="default2"
              data-test-id="merchant-date-placed"
            >
              {placed.label}
            </Text>
          </Tooltip.Trigger>
          <Tooltip.Content side="bottom">
            <Tooltip.Arrow />
            {placed.tooltip}
          </Tooltip.Content>
        </Tooltip>
      )}
    </Box>
  );
};
