// Adapted from saleor-dashboard: src/components/ConditionalFilter/context/provider.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's only filter provider: the URL is the source of truth. Saleor's per-list
// providers, API providers and initial API state are dropped (no async filter values yet).
import type { FC, ReactNode } from "react";

import { STATIC_PRODUCT_OPTIONS } from "../constants";
import { useContainerState } from "../useContainerState";
import { useFilterWindow } from "../useFilterWindow";
import { useUrlValueProvider } from "../ValueProvider/useUrlValueProvider";
import { ConditionalFilterContext } from "./context";

/** The category row still exists when a URL carries one, but it is not offered in "add". */
const ADDABLE_PRODUCT_OPTIONS = STATIC_PRODUCT_OPTIONS.filter(
  (operand) => operand.value !== "category",
);

export const ConditionalProductFilterProvider: FC<{
  locationSearch: string;
  children: ReactNode;
}> = ({ children, locationSearch }) => {
  const valueProvider = useUrlValueProvider(locationSearch);
  const containerState = useContainerState(valueProvider);
  const filterWindow = useFilterWindow();

  return (
    <ConditionalFilterContext.Provider
      value={{
        valueProvider,
        leftOperandsProvider: { operands: ADDABLE_PRODUCT_OPTIONS },
        containerState,
        filterWindow,
      }}
    >
      {children}
    </ConditionalFilterContext.Provider>
  );
};
