// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/context.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { createContext, useContext } from "react";

import type { FilterEventEmitter } from "./EventEmitter";

interface Context {
  emitter: FilterEventEmitter;
  actionButtonsDisabled: boolean;
}

export const FilterContext = createContext<Context | undefined>(undefined);

export const useFilterContext = () => {
  const context = useContext(FilterContext);

  if (!context) {
    throw new Error("Filter context must be used within FilterContext.Provider");
  }

  return context;
};
