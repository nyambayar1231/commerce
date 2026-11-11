// Adapted from saleor-dashboard: src/components/StatusDot/StatusDot.tsx and src/misc.ts (getDotColor)
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's small round status dot. Only the statuses the product tiles use are kept: success for
// published and error for hidden. Saleor's scheduled/neutral/warning colors arrive with their first
// user.
import { Box, useTheme } from "@saleor/macaw-ui";

export type DotStatus = "success" | "error";

export interface StatusDotProps {
  status: DotStatus;
}

export const StatusDot = ({ status }: StatusDotProps) => {
  const { themeValues } = useTheme();
  // Saleor's success is the hard-coded green getDotColor uses (there is no success2 token yet).
  const color =
    status === "success" ? "hsla(173, 100%, 26%, 1)" : themeValues.colors.background.critical2;

  return <Box width={2} height={2} borderRadius="50%" __backgroundColor={color} />;
};
