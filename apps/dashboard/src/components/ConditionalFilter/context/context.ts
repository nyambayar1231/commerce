// Adapted from saleor-dashboard: src/components/ConditionalFilter/context/context.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's filter context: the URL provider, the working copy, the panel window and the
// async option source. Saleor's per-list query API type is dropped.
import { createContext } from "react";

import type { FilterAPIProvider } from "../API/FilterAPIProvider";
import type { FilterValueProvider } from "../FilterValueProvider";
import type { LeftOperandsProvider } from "../LeftOperandsProvider";
import type { useContainerState } from "../useContainerState";
import type { FilterWindow } from "../useFilterWindow";

export const ConditionalFilterContext = createContext<{
  /** Only the product list offers API options today; a panel without one has none. */
  apiProvider?: FilterAPIProvider;
  valueProvider: FilterValueProvider;
  leftOperandsProvider: LeftOperandsProvider;
  containerState: ReturnType<typeof useContainerState>;
  filterWindow: FilterWindow;
} | null>(null);
