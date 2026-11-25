"use client";

import { useEffect, useState, useTransition } from "react";
import type { AddToCartAction, CartErrorKey } from "@/lib/cart/types";
import { useCartUI } from "./cart-context";

/**
 * Shared by the product page's buttons and the cards' quick add: runs the action, shows its error,
 * and opens the cart drawer after a success. The drawer opens once the transition has finished,
 * i.e. after the action's `refresh()` has re-rendered the drawer's contents; opening on the
 * action's result would flash the old (possibly empty) cart first.
 */
export function useAddToCart(addAction: AddToCartAction) {
  const { open } = useCartUI();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<CartErrorKey | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (added && !pending) {
      setAdded(false);
      open();
    }
  }, [added, pending, open]);

  const add = (variantId: string) => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await addAction(variantId);
      if (result.status === "success") setAdded(true);
      else setError(result.message ?? "generic");
    });
  };

  return { add, pending, error };
}
