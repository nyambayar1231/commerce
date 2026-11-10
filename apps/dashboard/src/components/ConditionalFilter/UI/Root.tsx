// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/Root.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel shell. Only the panel layout is implemented; the prop type keeps Saleor's name.
import { Box } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import { FilterContext } from "./context";
import { Filters } from "./Filters";
import { NoValue } from "./NoValue";
import type { FilterError, FilterEvent, LeftOperatorOption, Row } from "./types";
import { useEventEmitter } from "./useEvents";

export type ConditionalFiltersLayout = "popover" | "inline" | "panel";

export interface ExperimentalFiltersProps {
  value: Array<Row | string>;
  leftOptions: LeftOperatorOption[];
  children?: ReactNode;
  onChange?: (event: FilterEvent["detail"]) => void;
  locale?: Record<string, string>;
  error?: FilterError[];
  layout?: ConditionalFiltersLayout;
}

export const Root = ({
  value,
  onChange,
  leftOptions,
  children,
  layout = "panel",
  locale = {
    WHERE: "Where",
    AND: "and",
    noValueText: "No filters",
  },
  error,
}: ExperimentalFiltersProps): React.ReactNode => {
  const { emitter } = useEventEmitter({ onChange });
  const rows =
    value.length > 0 ? (
      <Filters
        value={value}
        leftOptions={leftOptions}
        emitter={emitter}
        locale={locale}
        error={error}
        layout={layout}
      />
    ) : (
      <NoValue locale={locale} />
    );

  return (
    <FilterContext.Provider value={{ emitter, actionButtonsDisabled: value.length === 0 }}>
      <Box display="flex" flexDirection="column" width="100%" __minWidth="0">
        <Box padding={4}>{rows}</Box>
        {children}
      </Box>
    </FilterContext.Provider>
  );
};
