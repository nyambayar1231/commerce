// Adapted from saleor-dashboard: src/components/Card/Actions.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type PropsWithBox } from "@saleor/macaw-ui";

export const Actions = ({ children, className, style, ...rest }: PropsWithBox<object>) => (
  <Box
    display="flex"
    flexDirection="row"
    gap={2}
    alignItems="center"
    justifyContent="flex-start"
    paddingX={6}
    paddingY={4}
    className={className}
    style={style}
    {...rest}
  >
    {children}
  </Box>
);
