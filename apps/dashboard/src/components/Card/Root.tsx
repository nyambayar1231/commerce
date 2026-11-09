// Adapted from saleor-dashboard: src/components/Card/Root.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, type BoxProps } from "@saleor/macaw-ui";

const borderProps: BoxProps = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "default1",
  borderRadius: 2,
  padding: 4,
};

export const Root = ({ children, withBorder, ...rest }: { withBorder?: boolean } & BoxProps) => (
  <Box
    display="flex"
    flexDirection="column"
    gap={5}
    backgroundColor="default1"
    {...(withBorder ? borderProps : {})}
    {...rest}
  >
    {children}
  </Box>
);
