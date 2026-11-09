// Adapted from saleor-dashboard: src/components/Modal/context.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type * as React from "react";
import { createContext } from "react";

interface ModalContextValues {
  open?: boolean;
  onChange?: (open: boolean) => void;
}

const ModalContext = createContext<ModalContextValues | null>(null);

export const ModalContextProvider = ({
  children,
  onChange,
  open,
}: {
  children: React.ReactNode;
  onChange?: (open: boolean) => void;
  open?: boolean;
}) => {
  return <ModalContext.Provider value={{ open, onChange }}>{children}</ModalContext.Provider>;
};
