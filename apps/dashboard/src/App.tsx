import { Box, Text } from "@saleor/macaw-ui";
import { useIntl } from "react-intl";

import { sectionNames } from "./intl";

export function App() {
  const intl = useIntl();

  return (
    <Box padding={6}>
      <Text size={5} fontWeight="bold">
        {intl.formatMessage(sectionNames.home)}
      </Text>
    </Box>
  );
}
