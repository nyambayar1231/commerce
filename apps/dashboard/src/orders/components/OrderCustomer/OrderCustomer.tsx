// Adapted from saleor-dashboard: src/orders/components/OrderCustomer/OrderCustomer.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Customer details", read-only (owner decision 4 of M6): the customer's email and the order's
// shipping and billing addresses, and Saleor's "View profile" link when the order belongs to a
// customer account (M7.5). Left out: the "View orders" link (our order list has no customer
// filter); address editing; copy buttons; pickup locations. Saleor shows "Same as
// shipping address" only when both are one address row; ours are always separate copies, so the
// billing address is always printed.
import { Box, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router";

import { DashboardCard } from "../../../components/Card";
import { ReadonlyAddress } from "../../../components/ReadonlyAddress/ReadonlyAddress";
import { customerUrl } from "../../../customers/urls";
import type { OrderDetailsFragment } from "../../../graphql/types.generated";

type OrderCustomerProps = Pick<
  OrderDetailsFragment,
  "userEmail" | "user" | "shippingAddress" | "billingAddress"
>;

export const OrderCustomer = ({
  userEmail,
  user,
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
          <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={2}>
            <Text color="default2" size={4}>
              <FormattedMessage id="hkENym" defaultMessage="Customer" />
            </Text>
            {user && (
              <Link
                to={customerUrl(user.id)}
                style={{ textDecoration: "none" }}
                data-test-id="view-profile"
              >
                <Text color="accent1" size={3}>
                  <FormattedMessage id="7A+FJl" defaultMessage="View profile" description="link" />
                </Text>
              </Link>
            )}
          </Box>
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
