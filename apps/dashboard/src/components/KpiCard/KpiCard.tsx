// Adapted from saleor-dashboard: src/components/KpiCard/KpiCard.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's KPI tile: icon, title with an info tooltip, the value (with an optional tooltip of its
// own) and a subtitle line, or skeletons while loading. Left out: the trend delta and the
// selectable (clickable/active) variant, which the customer overview doesn't use.
import { Box, Skeleton, Text, Tooltip } from "@saleor/macaw-ui";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./KpiCard.module.css";

interface KpiCardProps {
  title: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  tooltip?: ReactNode;
  valueTooltip?: ReactNode;
  loading?: boolean;
  dataTestId?: string;
}

export const KpiCard = ({
  title,
  value,
  icon,
  subtitle,
  tooltip,
  valueTooltip,
  loading,
  dataTestId,
}: KpiCardProps): ReactNode => {
  if (loading) {
    return (
      <Box
        borderWidth={1}
        borderStyle="solid"
        borderColor="default1"
        borderRadius={4}
        padding={4}
        display="flex"
        flexDirection="column"
        gap={2}
        data-test-id={dataTestId}
      >
        <Skeleton __width="80px" __height="12px" />
        <Skeleton __width="120px" __height="28px" />
        <Skeleton __width="60%" __height="12px" />
      </Box>
    );
  }

  return (
    <Box
      borderWidth={1}
      borderStyle="solid"
      borderColor="default1"
      borderRadius={4}
      padding={4}
      display="flex"
      flexDirection="column"
      gap={1}
      className={styles.card}
      data-test-id={dataTestId}
    >
      <Box display="flex" alignItems="center" gap={1.5}>
        {icon && (
          <Box display="flex" color="default2" flexShrink="0">
            {icon}
          </Box>
        )}
        <Text size={2} color="default2" fontWeight="medium">
          {title}
        </Text>
        {tooltip && (
          <Box display="flex" data-test-id="kpi-tooltip-trigger">
            <Tooltip>
              <Tooltip.Trigger>
                <Box display="flex" color="default2" alignItems="center">
                  <Info size={13} />
                </Box>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" className={styles.tooltipContent}>
                <Tooltip.Arrow />
                <Text size={2} color="default1">
                  {tooltip}
                </Text>
              </Tooltip.Content>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Box display="flex" flexDirection="column" gap={1}>
        {valueTooltip ? (
          <Box display="inline-flex" alignSelf="start" data-test-id="kpi-value-tooltip-trigger">
            <Tooltip>
              <Tooltip.Trigger>
                <Text
                  size={7}
                  fontWeight="bold"
                  __lineHeight="1.1"
                  className={styles.valueWithTooltip}
                >
                  {value}
                </Text>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" className={styles.tooltipContent}>
                <Tooltip.Arrow />
                <Text size={2} color="default1">
                  {valueTooltip}
                </Text>
              </Tooltip.Content>
            </Tooltip>
          </Box>
        ) : (
          <Text size={7} fontWeight="bold" __lineHeight="1.1">
            {value}
          </Text>
        )}

        <Box display="flex" alignItems="center" gap={1} className={styles.subtitleSlot}>
          {subtitle && (
            <Text size={1} color="default2">
              {subtitle}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

KpiCard.displayName = "KpiCard";
