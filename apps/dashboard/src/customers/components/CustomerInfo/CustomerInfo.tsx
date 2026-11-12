// Adapted from saleor-dashboard: src/customers/components/CustomerInfo/CustomerInfo.tsx and
// messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The "Contact" card in the sidebar: first name, last name and email, with the API's errors on
// their inputs. Saleor's note field is left out (no notes: PLAN M7 decision 3).
import { Box, Input } from "@saleor/macaw-ui";
import type * as React from "react";
import { defineMessages, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import type { AccountErrorFragment } from "../../../graphql/types.generated";
import { commonMessages } from "../../../intl";
import { getAccountErrorMessage, getFormErrors } from "../../../utils/errors";

const messages = defineMessages({
  title: {
    id: "QlSHOW",
    defaultMessage: "Contact",
    description: "customer detail sidebar, name email and note",
  },
});

export interface CustomerInfoData {
  firstName: string;
  lastName: string;
  email: string;
}

interface CustomerInfoProps {
  data: CustomerInfoData;
  disabled: boolean;
  errors: AccountErrorFragment[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CustomerInfo = ({ data, disabled, errors, onChange }: CustomerInfoProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["firstName", "lastName", "email"], errors);

  return (
    <DetailSettingsCard data-test-id="customer-details" title={intl.formatMessage(messages.title)}>
      <Box display="flex" flexDirection="column" gap={5}>
        <Input
          data-test-id="customer-first-name"
          disabled={disabled}
          error={!!formErrors.firstName}
          helperText={getAccountErrorMessage(formErrors.firstName, intl)}
          name="firstName"
          label={intl.formatMessage(commonMessages.firstName)}
          value={data.firstName}
          onChange={onChange}
        />
        <Input
          data-test-id="customer-last-name"
          disabled={disabled}
          error={!!formErrors.lastName}
          helperText={getAccountErrorMessage(formErrors.lastName, intl)}
          name="lastName"
          label={intl.formatMessage(commonMessages.lastName)}
          value={data.lastName}
          onChange={onChange}
        />
        <Input
          data-test-id="customer-email"
          disabled={disabled}
          error={!!formErrors.email}
          helperText={getAccountErrorMessage(formErrors.email, intl)}
          name="email"
          type="email"
          label={intl.formatMessage(commonMessages.email)}
          value={data.email}
          onChange={onChange}
        />
      </Box>
    </DetailSettingsCard>
  );
};
