import { Box, Text } from "@saleor/macaw-ui";
import type { MessageDescriptor } from "react-intl";
import { useIntl } from "react-intl";

interface PlaceholderPageProps {
  title: MessageDescriptor;
}

// Stands in for a section until its milestone builds the real page (PLAN.md).
export const PlaceholderPage = ({ title }: PlaceholderPageProps) => {
  const intl = useIntl();

  return (
    <Box padding={6}>
      <Text size={5} fontWeight="bold">
        {intl.formatMessage(title)}
      </Text>
    </Box>
  );
};
