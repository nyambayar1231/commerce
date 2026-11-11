// Adapted from saleor-dashboard: src/components/Pill/Pill.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's status pill: the legacy Macaw Pill restyled with the status colors of getStatusColor.
// Macaw 3 has no Pill, so this is a small span with the same rounded border, colors and weight;
// `small` is Saleor's compact size used in transaction events.
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import { getStatusColor, type StatusType } from "../../misc";
import { useTheme } from "../../theme/hook";

interface PillProps {
  label: ReactNode;
  color: StatusType;
  size?: "small" | "medium";
  icon?: ReactNode;
  "data-test-id"?: string;
}

export const Pill = ({ label, color, size = "medium", icon, ...rest }: PillProps) => {
  const { theme } = useTheme();
  const colors = getStatusColor({ status: color, currentTheme: theme });

  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap={1}
      borderStyle="solid"
      borderWidth={1}
      paddingX={size === "small" ? 1.5 : 2}
      __borderRadius="32px"
      __backgroundColor={colors.base}
      __borderColor={colors.border}
      __color={colors.text}
      __fontWeight="500"
      __fontSize={size === "small" ? "12px" : "13px"}
      __lineHeight={size === "small" ? "18px" : "22px"}
      __whiteSpace="nowrap"
      data-test-id={rest["data-test-id"]}
    >
      {icon}
      {label}
    </Box>
  );
};
