// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/RangeInputWrapper.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import styles from "./RangeInputWrapper.module.css";

interface RangeInputWrapperProps {
  children: ReactNode;
  /** Side-by-side start/end when the value column is wide enough (date between). */
  inline?: boolean;
  /** Content-sized cap; datetime is wider than date. */
  compact?: "date" | "datetime";
}

const className = (inline: boolean) => (inline ? styles.inline : styles.root);

export const RangeInputWrapper = ({
  children,
  inline = false,
  compact = "date",
}: RangeInputWrapperProps): React.ReactNode => (
  <Box
    className={className(inline)}
    data-range-layout={inline ? "inline" : "stack"}
    data-range-size={inline ? compact : undefined}
    width={inline ? undefined : "100%"}
    __minWidth="0"
  >
    {children}
  </Box>
);
