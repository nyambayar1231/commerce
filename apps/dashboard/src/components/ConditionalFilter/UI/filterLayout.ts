// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/filterLayout.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { ConditionalFiltersLayout } from "./Root";

export const isFlatFilterLayout = (
  layout?: ConditionalFiltersLayout,
): layout is "inline" | "panel" => layout === "inline" || layout === "panel";
