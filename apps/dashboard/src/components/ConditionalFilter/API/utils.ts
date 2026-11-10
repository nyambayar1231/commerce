// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/utils.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { FilterContainer, FilterElement } from "../FilterElement/FilterElement";

export const getFilterElement = (value: FilterContainer, index: number): FilterElement => {
  const possibleFilterElement = value[index];

  if (
    !possibleFilterElement ||
    typeof possibleFilterElement === "string" ||
    Array.isArray(possibleFilterElement)
  ) {
    throw new Error("Unknown filter element used to create API handler");
  }

  return possibleFilterElement;
};
