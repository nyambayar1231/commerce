// Adapted from saleor-dashboard: src/components/ConditionalFilter/useFilteredOperands.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useMemo } from "react";

import type { FilterContainer } from "./FilterElement/FilterElement";
import { OccurrenceLimiter } from "./FilterElement/OccurrenceLimiter";
import type { LeftOperand } from "./LeftOperandsProvider";

export const useFilteredOperands = (
  operands: LeftOperand[],
  container: FilterContainer,
): LeftOperand[] =>
  useMemo(
    () => OccurrenceLimiter.filterAvailableOperands(operands, container),
    [operands, container],
  );
