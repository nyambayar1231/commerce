// Adapted from saleor-dashboard: src/staff/components/StaffProperties/StaffProperties.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The profile card of Account settings (PLAN M11.2): the initials circle and the name and email,
// read-only for now. Saleor's avatar upload, editing and email hints come with the staff pages.
import { Box, Input, Text } from "@saleor/macaw-ui";
import { defineMessages, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { commonMessages } from "../../../intl";
import { getUserInitials } from "../../../misc";

const messages = defineMessages({
  myProfile: {
    id: "zdyqBq",
    defaultMessage: "My profile",
    description: "account settings profile card title when viewing yourself",
  },
});

interface StaffPropertiesProps {
  data: { email: string; firstName: string; lastName: string };
}

export const StaffProperties = ({ data }: StaffPropertiesProps) => {
  const intl = useIntl();

  return (
    <DetailSettingsCard
      data-test-id="staff-member-information"
      title={intl.formatMessage(messages.myProfile)}
    >
      <Box display="grid" gap={6} __gridTemplateColumns="120px 1fr">
        <Box
          alignItems="center"
          borderRadius="100%"
          display="flex"
          justifyContent="center"
          overflow="hidden"
          backgroundColor="default3"
          __height="120px"
          __width="120px"
        >
          <Text color="default1" fontWeight="bold" textAlign="center" __fontSize={35}>
            {getUserInitials(data)}
          </Text>
        </Box>
        <Box display="grid" gap={4} gridTemplateColumns={{ mobile: 1, tablet: 2 }}>
          <Input
            size="small"
            disabled
            label={intl.formatMessage(commonMessages.firstName)}
            name="firstName"
            value={data.firstName}
            data-test-id="staffFirstName"
          />
          <Input
            size="small"
            disabled
            label={intl.formatMessage(commonMessages.lastName)}
            name="lastName"
            value={data.lastName}
            data-test-id="staffLastName"
          />
          <Box __gridColumn="1 / -1" width="100%">
            <Input
              size="small"
              disabled
              label={intl.formatMessage(commonMessages.email)}
              name="email"
              value={data.email}
              data-test-id="staffEmail"
            />
          </Box>
        </Box>
      </Box>
    </DetailSettingsCard>
  );
};
