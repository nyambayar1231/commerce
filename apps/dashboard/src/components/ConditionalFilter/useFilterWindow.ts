// Adapted from saleor-dashboard: src/components/ConditionalFilter/useFilterWindow.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useMemo, useState } from "react";

export interface FilterWindow {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const useFilterWindow = (): FilterWindow => {
  const [open, setOpen] = useState(false);

  return useMemo(
    () => ({
      isOpen: open,
      setOpen,
    }),
    [open],
  );
};
