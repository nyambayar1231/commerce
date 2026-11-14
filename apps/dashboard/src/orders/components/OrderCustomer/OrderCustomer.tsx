// Adapted from saleor-dashboard: src/orders/components/OrderCustomer/OrderCustomer.tsx,
// CustomerEditForm.tsx and messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Customer details": the customer's email and the order's shipping and billing addresses, and
// Saleor's "View profile" link when the order belongs to a customer account (M7.5). A draft
// (M13.7) passes the editing handlers: Saleor's "Change customer" button opens its customer search
// (accounts by email, or "Use email: …" for any typed address), and each address gets Saleor's
// "Edit" button. Left out: the "View orders" link (our order list has no customer filter); copy
// buttons; pickup locations; Saleor's customer-change dialog (no address books to copy from).
// Saleor shows "Same as shipping address" only when both are one address row; ours are always
// separate copies, so the billing address is always printed.
import { useQuery } from "@apollo/client";
import { Box, Button, DynamicCombobox, type Option, Text } from "@saleor/macaw-ui";
import { useMemo, useState } from "react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";

import { DashboardCard } from "../../../components/Card";
import { ReadonlyAddress } from "../../../components/ReadonlyAddress/ReadonlyAddress";
import { customerUrl } from "../../../customers/urls";
import {
  type OrderDetailsFragment,
  SearchCustomersDocument,
} from "../../../graphql/types.generated";
import useDebounce from "../../../hooks/useDebounce";
import { buttonMessages } from "../../../intl";

const messages = defineMessages({
  changeCustomer: { id: "kKxHG9", defaultMessage: "Change customer" },
  searchCustomers: { id: "hkSkNx", defaultMessage: "Search Customers" },
  useEmail: { id: "9Z7LQq", defaultMessage: "Use email:" },
});

/** The draft's new customer: an account, or just an email. */
export type CustomerChange = { user: string } | { userEmail: string };

type OrderCustomerProps = Pick<
  OrderDetailsFragment,
  "userEmail" | "user" | "shippingAddress" | "billingAddress"
> & {
  onCustomerChange?: (change: CustomerChange) => void;
  onShippingAddressEdit?: () => void;
  onBillingAddressEdit?: () => void;
};

/** Saleor's CustomerEditForm: accounts matching the search, and "Use email: …" for a new one. */
const CustomerEditForm = ({ onChange }: { onChange: (change: CustomerChange) => void }) => {
  const intl = useIntl();
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce<string>((value) => setSearch(value), 300);
  const { data, loading } = useQuery(SearchCustomersDocument, {
    variables: { first: 20, query: search },
  });

  const options = useMemo(() => {
    const users: Option[] =
      data?.customers?.edges.map(({ node }) => ({ label: node.email, value: node.id })) ?? [];
    const typed = inputValue.trim();

    if (
      typed.includes("@") &&
      !users.some((user) => user.label.toLowerCase() === typed.toLowerCase())
    ) {
      users.unshift({ label: `${intl.formatMessage(messages.useEmail)} ${typed}`, value: typed });
    }

    return users;
  }, [data, inputValue, intl]);

  return (
    <DynamicCombobox
      data-test-id="select-customer"
      label={intl.formatMessage(messages.searchCustomers)}
      options={options}
      value={null}
      loading={loading}
      onChange={(option) => {
        if (!option) return;
        onChange(option.value.includes("@") ? { userEmail: option.value } : { user: option.value });
      }}
      onInputValueChange={(value) => {
        setInputValue(value);
        debouncedSearch(value);
      }}
    />
  );
};

const EditButton = ({ onClick, testId }: { onClick: () => void; testId: string }) => (
  <Button variant="secondary" size="small" onClick={onClick} data-test-id={testId}>
    <FormattedMessage {...buttonMessages.edit} />
  </Button>
);

export const OrderCustomer = ({
  userEmail,
  user,
  shippingAddress,
  billingAddress,
  onCustomerChange,
  onShippingAddressEdit,
  onBillingAddressEdit,
}: OrderCustomerProps) => {
  const [editingCustomer, setEditingCustomer] = useState(false);

  return (
    <DashboardCard>
      <DashboardCard.Header>
        <DashboardCard.Title>
          <FormattedMessage
            id="+ahkGr"
            defaultMessage="Customer details"
            description="section header"
          />
        </DashboardCard.Title>
        {onCustomerChange && (
          <DashboardCard.Toolbar>
            <Button
              variant="secondary"
              onClick={() => setEditingCustomer((editing) => !editing)}
              data-test-id="change-customer"
            >
              <FormattedMessage {...messages.changeCustomer} />
            </Button>
          </DashboardCard.Toolbar>
        )}
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
                    <FormattedMessage
                      id="7A+FJl"
                      defaultMessage="View profile"
                      description="link"
                    />
                  </Text>
                </Link>
              )}
            </Box>
            {editingCustomer && onCustomerChange ? (
              <CustomerEditForm
                onChange={(change) => {
                  setEditingCustomer(false);
                  onCustomerChange(change);
                }}
              />
            ) : userEmail ? (
              <Text size={4} fontWeight="medium" data-test-id="customer-email">
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
            <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={2}>
              <Text color="default2" size={4}>
                <FormattedMessage id="ZpVtCa" defaultMessage="Shipping address" />
              </Text>
              {onShippingAddressEdit && (
                <EditButton onClick={onShippingAddressEdit} testId="edit-shipping-address" />
              )}
            </Box>
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
            <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={2}>
              <Text color="default2" size={4}>
                <FormattedMessage id="6orx1c" defaultMessage="Billing address" />
              </Text>
              {onBillingAddressEdit && (
                <EditButton onClick={onBillingAddressEdit} testId="edit-billing-address" />
              )}
            </Box>
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
};
