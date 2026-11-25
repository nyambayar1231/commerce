// Adapted from saleor-storefront: src/ui/components/pdp/sticky-bar.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { useSyncExternalStore } from "react";
import type { AddToCartAction } from "@/lib/cart/types";
import { cn } from "@/lib/utils";
import type { AddToCartState } from "./add-to-cart";
import { AddToCartButton } from "./add-to-cart";

/** Scroll threshold (in pixels) before showing the sticky bar. */
const SCROLL_THRESHOLD = 500;

function subscribeToScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

function getScrollSnapshot() {
  return window.scrollY > SCROLL_THRESHOLD;
}

function getServerScrollSnapshot() {
  return false;
}

interface StickyBarProps {
  productName: string;
  price: string;
  /** Only when a buyable variant is selected (Paper: the bar hides for a disabled ATC). */
  show?: boolean;
  buttonState: AddToCartState;
  variantId: string | null;
  addAction: AddToCartAction;
}

/**
 * The mobile sticky bar: name and price with the add-to-cart button, fixed to the bottom once
 * the shopper has scrolled past the buy box. It renders inside the buy box's form, so its
 * button shares the form and the add-to-cart action.
 */
export function StickyBar({
  productName,
  price,
  show = false,
  buttonState,
  variantId,
  addAction,
}: StickyBarProps) {
  const scrolledPastThreshold = useSyncExternalStore(
    subscribeToScroll,
    getScrollSnapshot,
    getServerScrollSnapshot,
  );

  const isVisible = show && scrolledPastThreshold;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-background transition-transform duration-300 md:hidden",
        isVisible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="container-content flex items-center justify-between gap-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{productName}</p>
          <p className="text-sm text-muted-foreground">{price}</p>
        </div>
        <AddToCartButton
          state={buttonState}
          variantId={variantId}
          addAction={addAction}
          className="min-w-[130px] shrink-0"
          messageClassName="absolute bottom-full left-0 right-0 border-t bg-background px-4 py-1"
        />
      </div>
    </div>
  );
}
