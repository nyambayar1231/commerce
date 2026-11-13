// Adapted from saleor-dashboard: src/staff/components/StaffDetailsPage/StaffDetailsTitle.tsx and
// src/components/ChannelsAvailabilityDropdown/ProductAvailabilityStatusLabel.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The page title (PLAN M11.2): the name, the "Me" pill and the status. Only the signed-in user's
// page exists, and a signed-in user is active, so the status is always Saleor's "Active" with its
// green dot; Inactive and Pending invite come with the staff pages.
import { Box, Text } from "@saleor/macaw-ui";
import { defineMessages, useIntl } from "react-intl";

import { Pill } from "../../../components/Pill/Pill";
import { StatusDot } from "../../../components/StatusDot/StatusDot";

const messages = defineMessages({
  me: {
    id: "MkPAWX",
    defaultMessage: "Me",
    description: "pill on staff details when viewing your own profile",
  },
  active: {
    id: "c24hjq",
    defaultMessage: "Active",
    description: "status",
  },
});

export const StaffDetailsTitle = ({ name }: { name: string | undefined }) => {
  const intl = useIntl();

  return (
    <Box
      display="flex"
      alignItems="baseline"
      gap={2}
      flexWrap="nowrap"
      paddingRight={3}
      __minWidth="0"
    >
      <Box
        title={name}
        __maxWidth="320px"
        __overflow="hidden"
        __textOverflow="ellipsis"
        __whiteSpace="nowrap"
        __minWidth="0"
      >
        {name}
      </Box>
      <Pill
        data-test-id="staff-member-me"
        label={intl.formatMessage(messages.me)}
        color="neutral"
      />
      <Box
        data-test-id="staff-member-status"
        display="flex"
        alignItems="baseline"
        gap={2}
        flexShrink="0"
      >
        <Box flexShrink="0" display="flex" alignItems="center" __height="1em">
          <StatusDot status="success" />
        </Box>
        <Text size={2}>{intl.formatMessage(messages.active)}</Text>
      </Box>
    </Box>
  );
};
