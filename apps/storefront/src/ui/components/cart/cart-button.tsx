"use client";

// Adapted from saleor-storefront: src/ui/components/cart/cart-button.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCartUI } from "./cart-context";

/** The header's bag icon with the item count; opens the cart drawer. */
export function CartButton({ count }: { count: number }) {
  const t = useTranslations("nav");
  const { open } = useCartUI();

  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      data-testid="CartNavItem"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {count > 0 && (
        <span
          // A changed key remounts the badge, which restarts its CSS animation.
          key={count}
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-cart-badge-pop items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
      <span className="sr-only">{t("cartButton", { count })}</span>
    </button>
  );
}

/** Same size as `CartButton`, for the header slot's Suspense fallback. */
export function CartButtonSkeleton() {
  return <div aria-hidden="true" className="h-10 w-10 animate-pulse rounded-md bg-muted" />;
}
