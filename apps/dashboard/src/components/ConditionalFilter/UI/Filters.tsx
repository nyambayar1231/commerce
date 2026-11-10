// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/Filters.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The "Where" column and one RowComponent per row, with `AND` separators between them.
import { Box, Text } from "@saleor/macaw-ui";
import type { FilterEventEmitter } from "./EventEmitter";
import { createErrorLookup, getErrorByRowIndex } from "./errors";
import type { ExperimentalFiltersProps } from "./Root";
import { RowComponent } from "./Row";

type FiltersProps = Pick<ExperimentalFiltersProps, "value" | "leftOptions" | "error" | "layout"> & {
  emitter: FilterEventEmitter;
  locale: Record<string, string>;
};

export const Filters = ({
  value,
  leftOptions,
  emitter,
  locale,
  error,
  layout = "panel",
}: FiltersProps): React.ReactNode => {
  const errorsByRowIndex = createErrorLookup(error);

  return (
    <Box
      display="grid"
      __gridTemplateColumns="auto minmax(0, 1fr)"
      alignItems="start"
      columnGap={3}
      rowGap={3}
      alignSelf="start"
      width="100%"
      __minWidth="0"
    >
      <Text color="default2" paddingTop={1.5}>
        {locale.WHERE}
      </Text>
      {value.map((item, idx) =>
        typeof item === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: AND separators are positional
          <Text key={idx} color="default2" paddingTop={1.5}>
            {locale[item]}
          </Text>
        ) : (
          <RowComponent
            item={item}
            index={idx}
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, separated by AND strings
            key={`filterRow-${idx}`}
            leftOptions={leftOptions}
            emitter={emitter}
            error={getErrorByRowIndex(errorsByRowIndex, idx)}
            layout={layout}
          />
        ),
      )}
    </Box>
  );
};
