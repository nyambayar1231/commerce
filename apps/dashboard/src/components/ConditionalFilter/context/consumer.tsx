// Adapted from saleor-dashboard: src/components/ConditionalFilter/context/consumer.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useContext } from "react";

import { ConditionalFilterContext } from "./context";

export const useConditionalFilterContext = () => {
  const context = useContext(ConditionalFilterContext);

  if (!context) {
    throw new Error("Filter context must be used within ConditionalFilterContext.Provider.");
  }

  return context;
};
