"use client";

// Adapted from saleor-storefront: src/ui/components/cart/cart-context.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

// Only the drawer's open state lives here; the cart itself is server data (ARCHITECTURE §10.9).

type CartUI = { isOpen: boolean; open: () => void; close: () => void };

const noop = () => {};
const CartUIContext = createContext<CartUI>({ isOpen: false, open: noop, close: noop });

export function CartUIProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return <CartUIContext.Provider value={value}>{children}</CartUIContext.Provider>;
}

export function useCartUI(): CartUI {
  return useContext(CartUIContext);
}
