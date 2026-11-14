// Adapted from saleor-dashboard: src/orders/components/OrderSummary/OrderSummary.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Summary": the order value and the payments summary side by side, with Saleor's "Mark as Paid"
// button. Saleor shows it only for an order with no payment at all; ours always have one, so it
// shows while the order's `actions` include MARK_AS_PAID (something left uncharged, PLAN M6
// decision 5). Saleor's legacy payment buttons and editable variant are left out.
import { Box, Button, Text } from "@saleor/macaw-ui";
import { CheckIcon } from "lucide-react";
import { FormattedMessage } from "react-intl";

import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { messages as markAsPaidMessages } from "../OrderMarkAsPaidDialog/OrderMarkAsPaidDialog";
import { type EditableShipping, OrderValue } from "./OrderValue";
import { PaymentsSummary } from "./PaymentsSummary";

interface OrderSummaryProps {
  order: OrderDetailsFragment;
  onMarkAsPaid?: () => void;
  /** A draft's editable shipping row (M13.7). */
  editableShipping?: EditableShipping;
}

export const OrderSummary = ({ order, onMarkAsPaid, editableShipping }: OrderSummaryProps) => (
  <Box paddingX={6} paddingBottom={6} display="grid" gap={5} data-test-id="OrderSummary">
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Text size={6} fontWeight="medium">
        <FormattedMessage defaultMessage="Summary" id="RrCui3" />
      </Text>
      {onMarkAsPaid && order.actions.includes("MARK_AS_PAID") && (
        <Button variant="secondary" onClick={onMarkAsPaid} data-test-id="mark-as-paid-button">
          <CheckIcon size={16} />
          <FormattedMessage {...markAsPaidMessages.markAsPaid} />
        </Button>
      )}
    </Box>
    <Box display="grid" __gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap={3}>
      <OrderValue
        subtotal={order.subtotal}
        shippingPrice={order.shippingPrice}
        shippingMethodName={order.shippingMethodName}
        total={order.total}
        editable={editableShipping}
      />
      <PaymentsSummary {...order} />
    </Box>
  </Box>
);
