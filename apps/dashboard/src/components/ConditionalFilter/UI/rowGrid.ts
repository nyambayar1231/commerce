// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/rowGrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel's row grid: operand, condition, value and remove. Saleor's popover/inline and
// attribute column variants are dropped.
import { isFlatFilterLayout } from "./filterLayout";
import type { ConditionalFiltersLayout } from "./Root";

export const getGridTemplateColumns = (layout: ConditionalFiltersLayout): string => {
  if (isFlatFilterLayout(layout)) {
    return "minmax(140px, 0.75fr) minmax(80px, 0.35fr) minmax(200px, 2.2fr) auto";
  }

  return "140px 80px 200px auto";
};
