// Adapted from saleor-dashboard: src/components/Datagrid/hooks/useEmptyColumn.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's blank 20px first column: the left inset before a grid's first real column. It can't
// be selected visibly, resized away from its place or reordered.
import { useTheme } from "@saleor/macaw-ui";
import { useMemo } from "react";

import type { AvailableColumn } from "../types";

export const EMPTY_COLUMN_ID = "empty";

export const useEmptyColumn = (): AvailableColumn => {
  const { themeValues } = useTheme();

  return useMemo(
    () => ({
      id: EMPTY_COLUMN_ID,
      title: "",
      width: 20,
      disableReorder: true,
      themeOverride: {
        accentColor: themeValues.colors.background.default1,
        accentLight: themeValues.colors.background.default1,
        bgHeaderHovered: themeValues.colors.background.default1,
      },
    }),
    [themeValues],
  );
};
