// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/NoValue.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, Text } from "@saleor/macaw-ui";

export const NoValue = ({ locale }: { locale: Record<string, string> }): React.ReactNode => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    paddingY={6}
    data-test-id="filters-empty-state"
  >
    <Text size={3} color="default2">
      {locale.noValueText}
    </Text>
  </Box>
);
