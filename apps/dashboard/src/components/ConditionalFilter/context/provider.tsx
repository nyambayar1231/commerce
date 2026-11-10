// Adapted from saleor-dashboard: src/components/ConditionalFilter/context/provider.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's only filter provider: the URL is the source of truth, category options come
// from the API, and the category names behind the URL are looked up before the panel is shown.
// Saleor's per-list providers and its other API providers are dropped.
import type { FC, ReactNode } from "react";
import { useProductInitialAPIState } from "../API/initialState/product/useProductInitialAPIState";
import { useProductFilterAPIProvider } from "../API/providers/ProductFilterAPIProvider";
import { STATIC_PRODUCT_OPTIONS } from "../constants";
import { useContainerState } from "../useContainerState";
import { useFilterWindow } from "../useFilterWindow";
import { useUrlValueProvider } from "../ValueProvider/useUrlValueProvider";
import { ConditionalFilterContext } from "./context";

export const ConditionalProductFilterProvider: FC<{
  locationSearch: string;
  children: ReactNode;
}> = ({ children, locationSearch }) => {
  const apiProvider = useProductFilterAPIProvider();
  const initialState = useProductInitialAPIState();
  const valueProvider = useUrlValueProvider(locationSearch, initialState);
  const containerState = useContainerState(valueProvider);
  const filterWindow = useFilterWindow();

  return (
    <ConditionalFilterContext.Provider
      value={{
        apiProvider,
        valueProvider,
        leftOperandsProvider: { operands: STATIC_PRODUCT_OPTIONS },
        containerState,
        filterWindow,
      }}
    >
      {children}
    </ConditionalFilterContext.Provider>
  );
};
