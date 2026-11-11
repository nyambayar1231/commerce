// Adapted from saleor-dashboard: src/components/ConditionalFilter/context/provider.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product and order lists' filter providers: the URL is the source of truth. Products: category
// options come from the API, and the category names behind the URL are looked up before the panel
// is shown. Orders: the status options are the enum, with no lookup. Saleor's other per-list
// providers are dropped.
import type { FC, ReactNode } from "react";
import { useOrderInitialAPIState } from "../API/initialState/orders/InitialOrderStateResponse";
import { useProductInitialAPIState } from "../API/initialState/product/useProductInitialAPIState";
import { useOrderFilterAPIProvider } from "../API/providers/OrderFilterAPIProvider";
import { useProductFilterAPIProvider } from "../API/providers/ProductFilterAPIProvider";
import { STATIC_ORDER_OPTIONS, STATIC_PRODUCT_OPTIONS } from "../constants";
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

export const ConditionalOrderFilterProvider: FC<{
  locationSearch: string;
  children: ReactNode;
}> = ({ children, locationSearch }) => {
  const apiProvider = useOrderFilterAPIProvider();
  const initialState = useOrderInitialAPIState();
  const valueProvider = useUrlValueProvider(locationSearch, initialState);
  const containerState = useContainerState(valueProvider);
  const filterWindow = useFilterWindow();

  return (
    <ConditionalFilterContext.Provider
      value={{
        apiProvider,
        valueProvider,
        leftOperandsProvider: { operands: STATIC_ORDER_OPTIONS },
        containerState,
        filterWindow,
      }}
    >
      {children}
    </ConditionalFilterContext.Provider>
  );
};
