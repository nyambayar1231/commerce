// Adapted from saleor-dashboard: src/orders/components/OrderSummary/OrderSummary.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Summary": the order value and the payments summary side by side. The "Mark as paid" button
// arrives with M6.5; Saleor's legacy payment buttons and editable variant are left out.
import { Box, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";

import type { OrderDetailsFragment } from "../../../graphql/types.generated";
import { OrderValue } from "./OrderValue";
import { PaymentsSummary } from "./PaymentsSummary";

export const OrderSummary = ({ order }: { order: OrderDetailsFragment }) => (
  <Box paddingX={6} paddingBottom={6} display="grid" gap={5} data-test-id="OrderSummary">
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Text size={6} fontWeight="medium">
        <FormattedMessage defaultMessage="Summary" id="RrCui3" />
      </Text>
    </Box>
    <Box display="grid" __gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap={3}>
      <OrderValue
        subtotal={order.subtotal}
        shippingPrice={order.shippingPrice}
        shippingMethodName={order.shippingMethodName}
        total={order.total}
      />
      <PaymentsSummary {...order} />
    </Box>
  </Box>
);
