// Adapted from saleor-dashboard: src/orders/components/OrderDetailsItemsSection/
// OrderDetailsItemsSection.tsx and messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order's lines: the "Fulfill" button while something is left to fulfil, the unfulfilled
// lines, then one card per fulfillment. Saleor's timeline/line-matrix toggle, Return button,
// order-level refund callout and canceled-shipment toggle are left out (no returns, grant refunds
// or fulfillment cancel, PLAN M6 decisions 1–2).
import { Box, Button } from "@saleor/macaw-ui";
import { PackageIcon } from "lucide-react";
import { defineMessage, FormattedMessage } from "react-intl";

import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { OrderFulfillmentCard } from "../OrderFulfillmentCard/OrderFulfillmentCard";
import { OrderUnfulfilledProductsCard } from "../OrderUnfulfilledProductsCard/OrderUnfulfilledProductsCard";

const fulfillMessage = defineMessage({ id: "QDxJib", defaultMessage: "Fulfill" });

/** Saleor's canFulfill: something is left and the order isn't canceled. */
export const canFulfill = (order: Pick<OrderDetailsFragment, "status" | "lines">): boolean =>
  order.status !== "CANCELED" && order.lines.some((line) => line.quantityToFulfill > 0);

interface OrderDetailsItemsSectionProps {
  order: OrderDetailsFragment;
  onOrderFulfill: () => void;
}

export const OrderDetailsItemsSection = ({
  order,
  onOrderFulfill,
}: OrderDetailsItemsSectionProps) => (
  <Box data-test-id="order-details-items-section">
    {canFulfill(order) && (
      <Box paddingX={6} display="flex" justifyContent="flex-end" marginBottom={4}>
        <Button
          variant="primary"
          onClick={onOrderFulfill}
          data-test-id="order-items-fulfill-button"
        >
          <PackageIcon size={16} />
          <FormattedMessage {...fulfillMessage} />
        </Button>
      </Box>
    )}
    <OrderUnfulfilledProductsCard lines={order.lines} />
    {order.fulfillments.map((fulfillment) => (
      <OrderFulfillmentCard key={fulfillment.id} fulfillment={fulfillment} />
    ))}
  </Box>
);
