// Adapted from saleor-dashboard: src/customers/components/CustomerDetailsPage/Title.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The page title: the customer's name (or email), the Active/Inactive pill, the Staff pill for a
// staff user who placed orders, and "Member since {date}". Left out: the Unverified pill (no email
// confirmation until M8) and the customer type.
import { Box, Text } from "@saleor/macaw-ui";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";

import { Pill } from "../../../components/Pill/Pill";
import { getUserName } from "../../../misc";

interface CustomerDetailsTitleProps {
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    isActive?: boolean;
    isStaff?: boolean;
    dateJoined?: unknown;
  };
}

export const CustomerDetailsTitle = ({ customer }: CustomerDetailsTitleProps) => {
  const intl = useIntl();
  const customerName = getUserName(customer, true);

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Box
        title={customerName}
        __minWidth={0}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {customerName}
      </Box>
      {typeof customer.isActive === "boolean" &&
        (customer.isActive ? (
          <Pill
            color="success"
            label={intl.formatMessage({
              defaultMessage: "Active",
              description: "customer account is active",
              id: "8p8zxN",
            })}
            data-test-id="account-status-active"
          />
        ) : (
          <Pill
            color="neutral"
            label={intl.formatMessage({
              defaultMessage: "Inactive",
              description: "customer account is inactive (deactivated)",
              id: "3DDUnc",
            })}
            data-test-id="account-status-inactive"
          />
        ))}
      {customer.isStaff && customerName && (
        <Pill
          color="info"
          label={intl.formatMessage({
            defaultMessage: "Staff",
            description: "badge next to customer name marking this user as staff",
            id: "Jk8bsM",
          })}
          data-test-id="customer-staff-badge"
        />
      )}
      {typeof customer.dateJoined === "string" && (
        <Text size={3} fontWeight="regular" color="default2">
          <FormattedMessage
            defaultMessage="Member since {date}"
            description="customer detail page header, when this customer's account was created"
            id="8FgYfb"
            values={{
              date: <FormattedDate value={customer.dateJoined} month="short" year="numeric" />,
            }}
          />
        </Text>
      )}
    </Box>
  );
};
