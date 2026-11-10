// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/filterControlId.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
export const FILTER_CONTROL_ID_PREFIX = "conditional-filter";

type FilterControlField = "left" | "condition" | "right";

export const getFilterControlId = (field: FilterControlField, index: number) =>
  `${FILTER_CONTROL_ID_PREFIX}-${field}-${index}`;
