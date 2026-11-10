// Adapted from saleor-dashboard: src/components/ConditionalFilter/context/context.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's filter context: the URL provider, the working copy and the panel window.
// Saleor's API provider and query API type are dropped (M2.3.3a has no async filters).
import { createContext } from "react";

import type { FilterValueProvider } from "../FilterValueProvider";
import type { LeftOperandsProvider } from "../LeftOperandsProvider";
import type { useContainerState } from "../useContainerState";
import type { FilterWindow } from "../useFilterWindow";

export const ConditionalFilterContext = createContext<{
  valueProvider: FilterValueProvider;
  leftOperandsProvider: LeftOperandsProvider;
  containerState: ReturnType<typeof useContainerState>;
  filterWindow: FilterWindow;
} | null>(null);
