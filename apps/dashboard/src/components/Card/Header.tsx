// Adapted from saleor-dashboard: src/components/Card/Header.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type PropsWithBox } from "@saleor/macaw-ui";

export const Header = ({ children, className, ...rest }: PropsWithBox<object>) => (
  <Box
    paddingX={6}
    paddingTop={6}
    className={className}
    display="flex"
    flexDirection="row"
    alignItems="center"
    justifyContent="space-between"
    {...rest}
  >
    {children}
  </Box>
);
