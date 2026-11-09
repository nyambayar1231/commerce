// Adapted from saleor-dashboard: src/components/Card/Content.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type PropsWithBox } from "@saleor/macaw-ui";

export const Content = ({ children, ...rest }: PropsWithBox<object>) => (
  <Box paddingX={6} {...rest}>
    {children}
  </Box>
);
