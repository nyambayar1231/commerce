// Adapted from saleor-dashboard: src/orders/components/OrderCustomer/OrderCustomer.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Customer details", read-only (owner decision 4 of M6): the customer's email and the order's
// shipping and billing addresses. Left out: customer accounts (M7), so no "View profile" or
// "View orders" links; address editing; copy buttons; pickup locations. Saleor shows "Same as
// shipping address" only when both are one address row; ours are always separate copies, so the
// billing address is always printed.
import { Box, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";

import { DashboardCard } from "../../../components/Card";
import { ReadonlyAddress } from "../../../components/ReadonlyAddress/ReadonlyAddress";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";

type OrderCustomerProps = Pick<
  OrderDetailsFragment,
  "userEmail" | "shippingAddress" | "billingAddress"
>;

export const OrderCustomer = ({
  userEmail,
  shippingAddress,
  billingAddress,
}: OrderCustomerProps) => (
  <DashboardCard>
    <DashboardCard.Header>
      <DashboardCard.Title>
        <FormattedMessage
          id="+ahkGr"
          defaultMessage="Customer details"
          description="section header"
        />
      </DashboardCard.Title>
    </DashboardCard.Header>
    <DashboardCard.Content>
      <Box display="flex" flexDirection="column" gap={4}>
        <Box data-test-id="customer-email-section">
          <Text color="default2" size={4} display="block" marginBottom={2}>
            <FormattedMessage id="hkENym" defaultMessage="Customer" />
          </Text>
          {userEmail ? (
            <Text size={4} fontWeight="medium">
              {userEmail}
            </Text>
          ) : (
            <Text>
              <FormattedMessage
                id="Z7YrIb"
                defaultMessage="Not set"
                description="no customer assigned to order"
              />
            </Text>
          )}
        </Box>

        <Box data-test-id="shipping-address-section">
          <Text color="default2" size={4} display="block" marginBottom={2}>
            <FormattedMessage id="ZpVtCa" defaultMessage="Shipping address" />
          </Text>
          {shippingAddress ? (
            <ReadonlyAddress address={shippingAddress} />
          ) : (
            <Text>
              <FormattedMessage
                id="e7yOai"
                defaultMessage="Not set"
                description="shipping address is not set in draft order"
              />
            </Text>
          )}
        </Box>

        <Box data-test-id="billing-address-section">
          <Text color="default2" size={4} display="block" marginBottom={2}>
            <FormattedMessage id="6orx1c" defaultMessage="Billing address" />
          </Text>
          {billingAddress ? (
            <ReadonlyAddress address={billingAddress} />
          ) : (
            <Text>
              <FormattedMessage
                id="YI6Fhj"
                defaultMessage="Not set"
                description="no address is set in draft order"
              />
            </Text>
          )}
        </Box>
      </Box>
    </DashboardCard.Content>
  </DashboardCard>
);
