// Adapted from saleor-dashboard: src/products/components/ProductDoctor/sections/PublishedSection.tsx
// and src/products/components/ProductDoctor/AvailabilityCard.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The publish card, reduced to our single channel: the Published toggle, the "since <date>" line
// and the hidden-from-the-API note. No channel list, Manage button, availability-for-purchase,
// listings visibility, scheduling or diagnostics.
import { Box, Text, Toggle } from "@saleor/macaw-ui";
import { Eye, EyeOff, Info } from "lucide-react";
import { defineMessage, defineMessages, type IntlShape, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { getFormErrors, getProductErrorMessage } from "../../../utils/errors";

const sinceDateMessage = defineMessage<{ date: string }>({
  id: "qKiqXs",
  defaultMessage: "since {date}",
  description: "Date suffix for toggle controls",
});

const messages = defineMessages({
  title: {
    id: "XQfBeC",
    defaultMessage: "Availability",
    description: "Availability card title",
  },
  publishedLabel: {
    id: "U5dMfQ",
    defaultMessage: "Published",
    description: "Label for published toggle",
  },
  visibleNow: {
    id: "fxbjge",
    defaultMessage: "Visible now",
    description: "Status when product is currently visible on storefront",
  },
  notVisibleToCustomers: {
    id: "Cf7i/g",
    defaultMessage: "Hidden from public API.",
    description: "Info box title when product is not published",
  },
  publicApiReturnsNull: {
    id: "ofT0HH",
    defaultMessage: "Customers cannot find or view this product.",
    description: "Info box description for unpublished products",
  },
});

interface ProductAvailabilityCardProps {
  isPublished: boolean;
  publishedAt: unknown;
  disabled: boolean;
  errors: ProductErrorFragment[];
  onChange: (isPublished: boolean) => void;
}

const formatPublishedAt = (intl: IntlShape, publishedAt: unknown): string | null => {
  const date = typeof publishedAt === "string" ? new Date(publishedAt) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return intl.formatDate(date, { dateStyle: "medium" });
};

export const ProductAvailabilityCard = ({
  isPublished,
  publishedAt,
  disabled,
  errors,
  onChange,
}: ProductAvailabilityCardProps) => {
  const intl = useIntl();
  const formErrors = getFormErrors(["isPublished"], errors);
  const publishedSince = isPublished ? formatPublishedAt(intl, publishedAt) : null;

  return (
    <DetailSettingsCard title={intl.formatMessage(messages.title)} data-test-id="availability-card">
      <Box display="flex" flexDirection="column" gap={3}>
        <Box display="flex" alignItems="center" gap={3}>
          <Box display="flex" alignItems="center" color={isPublished ? "success1" : "default2"}>
            {isPublished ? (
              <Eye size={18} strokeWidth={2} aria-hidden />
            ) : (
              <EyeOff size={18} strokeWidth={1.5} aria-hidden />
            )}
          </Box>
          <Text size={2} fontWeight="medium" __flex="1">
            {intl.formatMessage(messages.publishedLabel)}
          </Text>
          <Toggle
            data-test-id="published-toggle"
            pressed={isPublished}
            onPressedChange={onChange}
            disabled={disabled}
            aria-label={intl.formatMessage(messages.publishedLabel)}
          />
        </Box>

        {isPublished ? (
          <Box marginLeft={8}>
            <Text size={2} color="default2">
              {publishedSince
                ? intl.formatMessage(sinceDateMessage, { date: publishedSince })
                : intl.formatMessage(messages.visibleNow)}
            </Text>
          </Box>
        ) : (
          <Box marginLeft={8} display="flex" alignItems="flex-start" gap={2}>
            <Box color="default2" display="flex" paddingTop={0.5} aria-hidden>
              <Info size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
            </Box>
            <Text size={2} color="default2">
              <Text size={2} fontWeight="medium">
                {intl.formatMessage(messages.notVisibleToCustomers)}
              </Text>{" "}
              {intl.formatMessage(messages.publicApiReturnsNull)}
            </Text>
          </Box>
        )}

        {formErrors.isPublished ? (
          <Box marginLeft={8}>
            <Text size={2} color="critical1" data-test-id="availability-error">
              {getProductErrorMessage(formErrors.isPublished, intl)}
            </Text>
          </Box>
        ) : null}
      </Box>
    </DetailSettingsCard>
  );
};
